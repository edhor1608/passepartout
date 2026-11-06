import Foundation
import Photos
import Testing

@testable import PassepartoutKit

/// The session through its public surface, with synthetic files as picked photos and a
/// recording library. The real `framePhoto` runs on small images.
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

  @Test func aDeniedLibraryKeepsPhotosQueuedUntilResume() async throws {
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
    session.resume()
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

  @Test func deletesEveryCopiedOriginal() async throws {
    await recorder.failSaves(of: "c-passepartout.jpg", times: 1)
    let session = FramingSession(library: recorder.library)

    session.add([try photo("a"), try garbage("b"), try photo("c")])
    await finish(session)

    let copies = await recorder.copies
    #expect(copies.count == 3)
    #expect(copies.allSatisfy { !FileManager.default.fileExists(atPath: $0.path) })
  }

  private func photo(_ name: String, width: Int = 600, height: Int = 400, failedLoads: Int = 0)
    throws -> FixtureSource
  {
    FixtureSource(
      url: try directory.solidImage(width: width, height: height, named: name),
      recorder: recorder,
      failedLoads: failedLoads)
  }

  private func garbage(_ name: String) throws -> FixtureSource {
    FixtureSource(
      url: try directory.write(Data("not an image".utf8), named: "\(name).jpg"),
      recorder: recorder)
  }

  private func finish(_ session: FramingSession) async {
    await session.runner?.value
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

/// A synthetic file as a picked photo.
struct FixtureSource: PhotoSource {
  let url: URL
  let recorder: Recorder
  /// Loads that throw before one succeeds, like an iCloud photo while offline.
  var failedLoads = 0

  func loadOriginal() async throws -> SourceFile? {
    if await recorder.log("load \(url.lastPathComponent)") < failedLoads {
      throw URLError(.notConnectedToInternet)
    }
    let file = try SourceFile(copying: url)
    await recorder.keep(file.url)
    return file
  }
}

/// What the session asked of its sources and its library, in order.
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

  /// Returns how often the event happened before.
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
