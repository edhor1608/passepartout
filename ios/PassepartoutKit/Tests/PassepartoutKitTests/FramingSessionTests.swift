import Foundation
import Photos
import Synchronization
import Testing

@testable import PassepartoutKit

@MainActor
struct FramingSessionTests {
  let directory: TestDirectory
  let recorder = Recorder()

  init() throws {
    directory = try TestDirectory()
  }

  @Test func asksForAccessOnceThenSavesEveryPhotoInPickOrder() async throws {
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a"), try photo("b", width: 400, height: 600), try photo("c")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved", "saved"])
    #expect(session.summary.saved == 3)
    #expect(session.summary.inProgress == 0)
    let events = await recorder.events
    #expect(
      events == [
        "access",
        "load a.jpeg", "save a-passepartout.jpg",
        "load b.jpeg", "save b-passepartout.jpg",
        "load c.jpeg", "save c-passepartout.jpg",
      ])
  }

  @Test func anEmptyPickDoesNothing() async {
    let session = FramingSession(library: recorder.library)

    session.add([FixtureSource]())

    #expect(!session.isRunning)
    let events = await recorder.events
    #expect(events.isEmpty)
  }

  @Test func oneFailingPhotoDoesNotStopTheBatch() async throws {
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a"), try garbage("b"), try photo("c")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "failed(unreadable)", "saved"])
    #expect(session.summary.completedUnits == session.summary.totalUnits)
    let saved = await recorder.saved
    #expect(saved == ["a-passepartout.jpg", "c-passepartout.jpg"])
  }

  @Test func retryRequeuesOnlyFailuresThatCanSucceed() async throws {
    await recorder.failSaves(of: "d-passepartout.jpg", times: 1)
    let session = FramingSession(library: recorder.library)

    session.add([
      try photo("a", failedLoads: 1), try garbage("b"), try photo("c", width: 3, height: 2),
      try photo("d"),
    ])
    await finish(session)

    #expect(
      session.photos.map(\.state.label) == [
        "failed(notLoaded)", "failed(unreadable)", "failed(tooSmall)", "failed(notSaved)",
      ])
    #expect(session.summary.retryable == 2)
    let firstRun = await recorder.events.count

    session.retryFailed()
    await finish(session)

    #expect(
      session.photos.map(\.state.label) == [
        "saved", "failed(unreadable)", "failed(tooSmall)", "saved",
      ])
    let retryRun = await recorder.events.dropFirst(firstRun)
    #expect(
      Array(retryRun) == [
        "access", "load a.jpeg", "save a-passepartout.jpg", "load d.jpeg",
        "save d-passepartout.jpg",
      ])
  }

  @Test func aDeniedLibraryKeepsPhotosQueuedUntilAccessIsCheckedAgain() async throws {
    await recorder.setBlocker(.denied)
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a")])
    await finish(session)
    session.add([try photo("b")])
    await finish(session)

    #expect(session.blocker == .denied)
    #expect(session.photos.map(\.state.label) == ["queued", "queued"])
    let events = await recorder.events
    #expect(events == ["access", "access"])

    await recorder.setBlocker(nil)
    session.appBecameActive()
    await finish(session)

    #expect(session.blocker == nil)
    #expect(session.photos.map(\.state.label) == ["saved", "saved"])
  }

  @Test func addingDuringARunExtendsItWithoutASecondRunner() async throws {
    let session = FramingSession(library: recorder.library)
    let later = [try photo("b"), try photo("c")]

    await recorder.onFirstSave {
      let runner = session.runner
      session.add(later)
      #expect(runner != nil && session.runner == runner)
    }
    session.add([try photo("a")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved", "saved"])
    let events = await recorder.events
    #expect(
      events == [
        "access",
        "load a.jpeg", "save a-passepartout.jpg",
        "load b.jpeg", "save b-passepartout.jpg",
        "load c.jpeg", "save c-passepartout.jpg",
      ])
  }

  @Test func aPauseFinishesThePhotoInFlightAndHoldsTheRestUntilAnExplicitResume() async throws {
    let session = FramingSession(library: recorder.library)
    await recorder.onFirstSave { session.pause() }

    session.add([try photo("a"), try photo("b"), try photo("c")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "queued", "queued"])
    #expect(session.isPaused)
    #expect(!session.isRunning)

    session.appBecameActive()

    #expect(session.isPaused)
    #expect(!session.isRunning)

    session.resume()
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved", "saved"])
    #expect(!session.isPaused)
  }

  @Test func returningToTheAppDoesNotLiftAPause() async throws {
    await recorder.setBlocker(.denied)
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a")])
    session.pause()
    await finish(session)

    #expect(session.blocker == .denied)
    #expect(session.isPaused)

    await recorder.setBlocker(nil)
    session.appBecameActive()
    await finish(session)

    #expect(session.isPaused)
    #expect(session.photos.map(\.state.label) == ["queued"])

    session.resume()
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved"])
  }

  @Test func photosThatNeedTheAppWaitForItInPickOrder() async throws {
    let session = FramingSession(library: recorder.library)

    session.appMovedToBackground()
    session.add([try photo("a"), try photo("b", inBackground: false), try photo("c")])
    #expect(!session.canFinishInBackground)
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "queued", "queued"])
    #expect(!session.isRunning)
    let eventsInBackground = await recorder.events
    #expect(eventsInBackground == ["access", "load a.jpeg", "save a-passepartout.jpg"])

    session.appBecameActive()
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved", "saved"])
    #expect(session.canFinishInBackground)
    let saved = await recorder.saved
    #expect(saved == ["a-passepartout.jpg", "b-passepartout.jpg", "c-passepartout.jpg"])
  }

  @Test(.timeLimit(.minutes(1)))
  func leavingTheAppSendsAHandoverInFlightBackToTheQueue() async throws {
    let held = StalledSource(loadsInBackground: false)
    let session = FramingSession(library: recorder.library, stallTimeout: .seconds(5))
    session.add([held, try photo("b")])
    try await waitUntil { session.photos.first?.state.label == "loading" }
    #expect(!session.canFinishInBackground)

    session.appMovedToBackground()
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["queued", "queued"])
    #expect(held.progress.isCancelled)
    #expect(held.loads == 1)

    session.appBecameActive()
    try await waitUntil { held.loads == 2 }
    _ = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved"])
  }

  @Test func newSourcesForQueuedPhotosLetThemLoadInTheBackground() async throws {
    let session = FramingSession(library: recorder.library)
    session.appMovedToBackground()
    session.add([try photo("a", inBackground: false), try photo("b", inBackground: false)])
    await finish(session)
    #expect(session.photos.map(\.state.label) == ["queued", "queued"])

    var updated: [String] = []
    session.updateQueuedSources { sources in
      sources.compactMap { $0 as? FixtureSource }.map { source in
        updated.append(source.url.lastPathComponent)
        var library = source
        library.loadsInBackground = true
        return library
      }
    }
    #expect(updated == ["a.jpeg", "b.jpeg"])
    #expect(session.canFinishInBackground)
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved", "saved"])
  }

  @Test func aPauseWithNothingQueuedLeavesNothingPaused() async throws {
    let session = FramingSession(library: recorder.library)
    await recorder.onFirstSave { session.pause() }

    session.add([try photo("a")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["saved"])
    #expect(!session.isPaused)

    session.pause()

    #expect(!session.isPaused)
  }

  @Test func addingAfterAFinishedBatchKeepsOnlyFailuresWorthRetrying() async throws {
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a"), try garbage("b"), try photo("c", failedLoads: 1)])
    await finish(session)
    session.add([try photo("d")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["failed(notLoaded)", "saved"])
    #expect(session.summary.retryable == 1)
    let saved = await recorder.saved
    #expect(saved == ["a-passepartout.jpg", "d-passepartout.jpg"])
  }

  @Test(.timeLimit(.minutes(1)))
  func aStalledDownloadFailsWithoutHoldingUpThePhotosBehindIt() async throws {
    let stalled = StalledSource()
    let session = FramingSession(library: recorder.library, stallTimeout: .milliseconds(200))

    session.add([stalled, try photo("b")])
    await finish(session)

    #expect(session.photos.map(\.state.label) == ["failed(notLoaded)", "saved"])
    #expect(stalled.progress.isCancelled)

    let lateCopy = try stalled.completeLate(
      copying: try directory.solidImage(width: 60, height: 40))
    #expect(!FileManager.default.fileExists(atPath: lateCopy.path))
    #expect(session.photos.map(\.state.label) == ["failed(notLoaded)", "saved"])
    #expect(!session.isRunning)
  }

  @Test(.timeLimit(.minutes(1)))
  func aSlowDownloadThatKeepsMovingShowsItsProgressAndFinishes() async throws {
    let session = FramingSession(library: recorder.library, stallTimeout: .seconds(1))
    let slow = SlowSource(file: try photo("a"), steps: 8, interval: .milliseconds(500))
    var fractions: [Double] = []
    var unitsWhileLoading: [Int64] = []
    let sampler = Task { @MainActor in
      while !Task.isCancelled {
        if case .loading(let fraction) = session.photos.first?.state {
          if let fraction { fractions.append(fraction) }
          unitsWhileLoading.append(session.summary.completedUnits)
        }
        try? await Task.sleep(for: .milliseconds(20))
      }
    }

    session.add([slow])
    await finish(session)
    sampler.cancel()

    #expect(session.photos.map(\.state.label) == ["saved"])
    #expect(fractions.contains { $0 > 0 && $0 < 1 }, "\(fractions)")
    #expect(Set(unitsWhileLoading).count >= 3, "\(unitsWhileLoading)")
    #expect(unitsWhileLoading == unitsWhileLoading.sorted(), "\(unitsWhileLoading)")
    #expect(unitsWhileLoading.allSatisfy { $0 < 100 }, "\(unitsWhileLoading)")
    #expect(session.summary.completedUnits == session.summary.totalUnits)
  }

  @Test(
    arguments: [
      (CocoaError(.fileWriteOutOfSpace), "failed(storageFull)"),
      (POSIXError(.ENOSPC), "failed(storageFull)"),
      (
        NSError(
          domain: "TransferDomain", code: 1,
          userInfo: [NSUnderlyingErrorKey: POSIXError(.ENOSPC) as NSError]),
        "failed(storageFull)"
      ),
      (URLError(.notConnectedToInternet), "failed(notLoaded)"),
    ] as [(any Error, String)])
  func aFullDiskIsNotReportedAsBeingOffline(error: any Error, expected: String) async {
    let session = FramingSession(library: recorder.library)

    session.add([FailingSource(error: error)])
    await finish(session)

    #expect(session.photos.map(\.state.label) == [expected])
    #expect(session.summary.retryable == 1)
  }

  @Test func deletesEveryCopiedOriginal() async throws {
    await recorder.failSaves(of: "c-passepartout.jpg", times: 1)
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a"), try garbage("b"), try photo("c")])
    await finish(session)

    let copies = await recorder.copies
    #expect(copies.count == 3)
    #expect(copies.allSatisfy { !FileManager.default.fileExists(atPath: $0.path) })
  }

  private func photo(
    _ name: String, width: Int = 600, height: Int = 400, failedLoads: Int = 0,
    inBackground: Bool = true
  ) throws -> FixtureSource {
    FixtureSource(
      url: try directory.solidImage(width: width, height: height, named: name),
      recorder: recorder,
      failedLoads: failedLoads,
      loadsInBackground: inBackground)
  }

  private func garbage(_ name: String) throws -> FixtureSource {
    FixtureSource(
      url: try directory.write(Data("not an image".utf8), named: "\(name).jpg"),
      recorder: recorder)
  }

  private func finish(_ session: FramingSession) async {
    await session.runner?.value
  }

  /// Polls until `condition` holds, for at most five seconds.
  private func waitUntil(_ condition: () -> Bool) async throws {
    let deadline = ContinuousClock.now + .seconds(5)
    while !condition() {
      try #require(ContinuousClock.now < deadline, "condition not met within five seconds")
      try await Task.sleep(for: .milliseconds(5))
    }
  }
}

struct LibraryBlockerTests {
  @Test(
    arguments: [
      (PHAuthorizationStatus.authorized, nil), (.limited, nil), (.denied, .denied),
      (.restricted, .restricted), (.notDetermined, .denied),
    ] as [(PHAuthorizationStatus, LibraryBlocker?)])
  func addOnlyStatusDecidesWhetherAddsMayRun(
    status: PHAuthorizationStatus, expected: LibraryBlocker?
  ) {
    #expect(LibraryBlocker.blocking(status) == expected)
  }

  @Test func aStatusFromANewerSystemBlocks() throws {
    let unknown = try #require(PHAuthorizationStatus(rawValue: 99))
    #expect(LibraryBlocker.blocking(unknown) == .denied)
  }
}

struct FixtureSource: PhotoSource {
  let url: URL
  let recorder: Recorder
  var failedLoads = 0
  var loadsInBackground = true

  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    let progress = Progress(totalUnitCount: 1)
    Task {
      do {
        completion(.success(try await load()))
      } catch {
        completion(.failure(error))
      }
      progress.completedUnitCount = 1
    }
    return progress
  }

  func load() async throws -> SourceFile {
    if await recorder.log("load \(url.lastPathComponent)") < failedLoads {
      throw URLError(.notConnectedToInternet)
    }
    let file = try SourceFile(copying: url)
    await recorder.keep(file.url)
    return file
  }
}

struct FailingSource: PhotoSource {
  let error: any Error
  var loadsInBackground: Bool { true }

  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    completion(.failure(error))
    return Progress(totalUnitCount: 1)
  }
}

final class StalledSource: PhotoSource {
  let progress = Progress(totalUnitCount: 100)
  let loadsInBackground: Bool
  private let completion = Mutex<(@Sendable (Result<SourceFile?, any Error>) -> Void)?>(nil)
  private let loadCount = Mutex(0)

  init(loadsInBackground: Bool = true) {
    self.loadsInBackground = loadsInBackground
  }

  var loads: Int { loadCount.withLock { $0 } }

  /// Keeps only the latest load's completion.
  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    self.completion.withLock { $0 = completion }
    loadCount.withLock { $0 += 1 }
    return progress
  }

  func completeLate(copying url: URL) throws -> URL {
    let file = try SourceFile(copying: url)
    let copy = file.url
    completion.withLock { $0 }?(.success(file))
    return copy
  }
}

struct SlowSource: PhotoSource {
  let file: FixtureSource
  let steps: Int64
  let interval: Duration
  var loadsInBackground: Bool { true }

  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    let progress = Progress(totalUnitCount: steps)
    Task {
      for step in 1...steps {
        try? await Task.sleep(for: interval)
        progress.completedUnitCount = step
      }
      do {
        completion(.success(try await file.load()))
      } catch {
        completion(.failure(error))
      }
    }
    return progress
  }
}

actor Recorder {
  private(set) var events: [String] = []
  private(set) var saved: [String] = []
  private(set) var copies: [URL] = []
  private var blocker: LibraryBlocker?
  private var saveFailures: [String: Int] = [:]
  private var firstSaveHook: (@MainActor @Sendable () -> Void)?

  nonisolated var library: PhotoLibrary {
    PhotoLibrary(
      requestAddAccess: { await self.requestAccess() },
      add: { _, filename in try await self.save(filename) })
  }

  func setBlocker(_ blocker: LibraryBlocker?) {
    self.blocker = blocker
  }

  func failSaves(of filename: String, times: Int) {
    saveFailures[filename] = times
  }

  func onFirstSave(_ hook: @escaping @MainActor @Sendable () -> Void) {
    firstSaveHook = hook
  }

  func log(_ event: String) -> Int {
    defer { events.append(event) }
    return events.count { $0 == event }
  }

  func keep(_ copy: URL) {
    copies.append(copy)
  }

  private func requestAccess() -> LibraryBlocker? {
    events.append("access")
    return blocker
  }

  private func save(_ filename: String) async throws {
    if log("save \(filename)") < saveFailures[filename, default: 0] {
      throw CocoaError(.fileWriteUnknown)
    }
    saved.append(filename)
    if let hook = firstSaveHook {
      firstSaveHook = nil
      await hook()
    }
  }
}

extension Photo.State {
  var label: String {
    switch self {
    case .queued: "queued"
    case .loading: "loading"
    case .framing: "framing"
    case .saving: "saving"
    case .saved: "saved"
    case .failed(let failure): "failed(\(failure))"
    }
  }
}
