import Foundation
import Synchronization
import Testing

@testable import PassepartoutKit

@MainActor
struct CollageSessionTests {
  let directory: TestDirectory
  let recorder = Recorder()
  let memory = MemorySettings()

  init() throws {
    directory = try TestDirectory()
  }

  @Test func aPickLoadsInPickOrderAndOpensTheEditor() async throws {
    let session = makeSession()

    session.openPicker()
    #expect(session.phase.label == "picking")
    session.pick([
      try photo("a"), try photo("b", width: 400, height: 600),
      try photo("c", width: 500, height: 500),
    ])
    #expect(session.phase.label == "loading")
    await finish(session)

    #expect(session.phase.label == "editing")
    let document = try #require(session.phase.document)
    #expect(document.photos.map(\.id) == [0, 1, 2])
    #expect(
      document.photos.map(\.original.pixelSize) == [
        PixelSize(width: 600, height: 400), PixelSize(width: 400, height: 600),
        PixelSize(width: 500, height: 500),
      ])
    #expect(session.phase.notice == nil)
    let events = await recorder.events
    #expect(events == ["load a.jpeg", "load b.jpeg", "load c.jpeg"])
  }

  @Test func photosThatFailAreDroppedWithANotice() async throws {
    let session = makeSession()

    session.pick([
      try photo("a"), try garbage("b"), FailingSource(error: URLError(.notConnectedToInternet)),
      try photo("d", width: 400, height: 600),
    ])
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(
      session.phase.document?.photos.map(\.original.pixelSize) == [
        PixelSize(width: 600, height: 400), PixelSize(width: 400, height: 600),
      ])
    #expect(session.phase.notice == .photosDropped(2))
  }

  @Test func whenNothingLoadsRetryLoadsTheSamePick() async throws {
    let session = makeSession()

    session.pick([try photo("a", failedLoads: 1), try photo("b", failedLoads: 1)])
    await finish(session)
    #expect(session.phase.label == "nothingLoaded")

    session.retryLoading()
    #expect(session.phase.label == "loading")
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.document?.photos.count == 2)
    #expect(session.phase.notice == nil)
    let events = await recorder.events
    #expect(events == ["load a.jpeg", "load b.jpeg", "load a.jpeg", "load b.jpeg"])
  }

  @Test func aPickBeyondTwelveIsCutToTwelve() async throws {
    let session = makeSession()

    session.pick(try (0..<14).map { try photo("p\($0)", width: 60, height: 40) })
    await finish(session)

    #expect(session.phase.document?.photos.count == 12)
    let events = await recorder.events
    #expect(events == (0..<12).map { "load p\($0).jpeg" })
  }

  @Test func closingThePickerWithoutAPickReturnsToStart() {
    let session = makeSession()

    session.openPicker()
    session.pick([])

    #expect(session.phase.label == "start")
    #expect(session.worker == nil)
  }

  @Test func aPickReportedAfterThePickerClosedStillLoads() async throws {
    let session = makeSession()

    session.openPicker()
    session.pick([])
    session.pick([try photo("a")])
    #expect(session.phase.label == "loading")
    await finish(session)

    #expect(session.phase.label == "editing")
  }

  @Test(.timeLimit(.minutes(1)))
  func cancellingALoadDropsTheHandoverAndItsLateCopy() async throws {
    let held = StalledSource()
    let session = makeSession()
    session.pick([held])
    try await waitUntil { held.loads == 1 }

    session.close()
    #expect(session.phase.label == "start")
    #expect(held.progress.isCancelled)

    let lateCopy = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    await finish(session)

    #expect(session.phase.label == "start")
    #expect(!FileManager.default.fileExists(atPath: lateCopy.path))
  }

  @Test(.timeLimit(.minutes(1)))
  func aLoadThatArrivesAsTheUserCancelsChangesNothing() async throws {
    let held = StalledSource()
    let session = makeSession()
    session.pick([held])
    try await waitUntil { held.loads == 1 }

    let copy = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    session.close()
    await finish(session)

    #expect(session.phase.label == "start")
    #expect(!FileManager.default.fileExists(atPath: copy.path))
  }

  @Test(.timeLimit(.minutes(1)))
  func aLateLoadDoesNotLeakIntoTheNextCollage() async throws {
    let held = StalledSource()
    let session = makeSession()
    session.pick([held])
    try await waitUntil { held.loads == 1 }
    let firstLoad = session.worker

    _ = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    session.close()
    session.pick([try photo("b", width: 400, height: 600)])
    await firstLoad?.value
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(
      session.phase.document?.photos.map(\.original.pixelSize) == [
        PixelSize(width: 400, height: 600)
      ])
  }

  @Test func startingOverBeforeTheFirstLoadRanLoadsOnlyTheNewPick() async throws {
    let session = makeSession()
    session.pick([try photo("a")])
    let firstLoad = session.worker

    session.close()
    session.pick([try photo("b", width: 400, height: 600)])
    await firstLoad?.value
    await finish(session)

    #expect(
      session.phase.document?.photos.map(\.original.pixelSize) == [
        PixelSize(width: 400, height: 600)
      ])
    let events = await recorder.events
    #expect(events == ["load b.jpeg"])
  }

  @Test(.timeLimit(.minutes(1)))
  func aStalledDownloadIsDroppedAndTheRestLoad() async throws {
    let stalled = StalledSource()
    let session = makeSession(stallTimeout: .milliseconds(200))

    session.pick([stalled, try photo("b")])
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.document?.photos.count == 1)
    #expect(session.phase.notice == .photosDropped(1))
    #expect(stalled.progress.isCancelled)
  }

  @Test(.timeLimit(.minutes(1)))
  func leavingTheAppHoldsAForegroundOnlyLoadUntilItReturns() async throws {
    let held = StalledSource(loadsInBackground: false)
    let session = makeSession()
    session.pick([held, try photo("b")])
    try await waitUntil { held.loads == 1 }

    session.appMovedToBackground()
    await finish(session)

    #expect(held.progress.isCancelled)
    #expect(session.phase.label == "loading")
    #expect(session.phase.finishedLoads == 0)

    session.appBecameActive()
    try await waitUntil { held.loads == 2 }
    _ = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.document?.photos.count == 2)
    #expect(session.phase.notice == nil)
  }

  @Test(.timeLimit(.minutes(1)))
  func leavingTheAppKeepsALoadThatCanRunInTheBackground() async throws {
    let held = StalledSource(loadsInBackground: true)
    let session = makeSession()
    session.pick([held])
    try await waitUntil { held.loads == 1 }

    session.appMovedToBackground()
    #expect(!held.progress.isCancelled)
    _ = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(held.loads == 1)
  }

  @Test(.timeLimit(.minutes(1)))
  func aQuickReturnToTheAppRetriesTheAbandonedHandover() async throws {
    let held = StalledSource(loadsInBackground: false)
    let session = makeSession()
    session.pick([held])
    try await waitUntil { held.loads == 1 }

    session.appMovedToBackground()
    session.appBecameActive()
    try await waitUntil { held.loads == 2 }
    _ = try held.completeLate(copying: try directory.solidImage(width: 60, height: 40))
    await finish(session)

    #expect(session.phase.label == "editing")
  }

  @Test func aPhotoThatNeedsTheAppHoldsTheQueueUntilItReturns() async throws {
    let session = makeSession()
    session.appMovedToBackground()

    session.pick([try photo("a"), try photo("b", inBackground: false), try photo("c")])
    await finish(session)

    #expect(session.phase.label == "loading")
    #expect(session.phase.finishedLoads == 1)
    let eventsInBackground = await recorder.events
    #expect(eventsInBackground == ["load a.jpeg"])

    session.appBecameActive()
    await finish(session)

    #expect(session.phase.document?.photos.count == 3)
    let events = await recorder.events
    #expect(events == ["load a.jpeg", "load b.jpeg", "load c.jpeg"])
  }

  @Test func savingAddsOneJPEGOfTheCanvasSize() async throws {
    let session = try await editingSession([
      try photo("a"), try photo("b", width: 400, height: 600),
    ])
    session.edit { $0.canvas = .square }

    session.save()
    #expect(session.phase.label == "saving")
    await finish(session)

    #expect(session.phase.label == "saved")
    let events = await recorder.events
    #expect(events.suffix(2) == ["access", "save Collage-passepartout.jpg"])
    let jpegs = await recorder.jpegs
    #expect(jpegs.count == 1)
    let output = try Pixels(jpeg: try #require(jpegs.first))
    #expect(PixelSize(width: output.width, height: output.height) == CollageCanvas.square.size)
  }

  @Test func nothingChangesTheCollageWhileItSaves() async throws {
    let session = try await editingSession([try photo("a")])
    let rendered = try #require(session.phase.document)
    let another = try photo("x")
    await recorder.onFirstSave {
      session.edit { $0.canvas = .square }
      session.save()
      session.close()
      session.openPicker()
      session.pick([another])
      session.retryLoading()
      #expect(session.phase.label == "saving")
      #expect(session.phase.document == rendered)
    }

    session.save()
    await finish(session)

    #expect(session.phase.label == "saved")
    #expect(session.phase.document == rendered)
    let saved = await recorder.saved
    #expect(saved.count == 1)
  }

  @Test func aFailedSaveReturnsToTheEditorWithItsDocument() async throws {
    await recorder.failSaves(of: "Collage-passepartout.jpg", times: 1)
    let session = try await editingSession([try photo("a"), try photo("b")])
    session.edit { $0.spacing = CollageSpacing(clamping: 10) }
    let document = try #require(session.phase.document)

    session.save()
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.notice == .notSaved(.notSaved))
    #expect(session.phase.document == document)

    session.save()
    await finish(session)

    #expect(session.phase.label == "saved")
  }

  @Test func aBlockedLibraryReturnsToTheEditor() async throws {
    await recorder.setBlocker(.denied)
    let session = try await editingSession([try photo("a")])

    session.save()
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.notice == .libraryBlocked(.denied))
    let saved = await recorder.saved
    #expect(saved.isEmpty)
  }

  @Test func aCollageThatCannotRenderReturnsToTheEditor() async throws {
    let session = try await editingSession([try photo("a")])
    let original = try #require(session.phase.document?.photos.first?.original.file.url)
    try FileManager.default.removeItem(at: original)

    session.save()
    await finish(session)

    #expect(session.phase.label == "editing")
    #expect(session.phase.notice == .notSaved(.unreadable))
    let saved = await recorder.saved
    #expect(saved.isEmpty)
  }

  @Test func anEditOnTheSavedCollageReturnsToTheEditorAndSavingAgainAddsAnotherPhoto() async throws
  {
    let session = try await editingSession([try photo("a")])
    session.save()
    await finish(session)
    #expect(session.phase.label == "saved")

    session.edit { $0.canvas = .portrait3x4 }
    #expect(session.phase.label == "saved")

    session.edit { $0.spacing = CollageSpacing(clamping: 0) }
    #expect(session.phase.label == "editing")
    #expect(session.phase.notice == nil)
    session.save()
    await finish(session)

    #expect(session.phase.label == "saved")
    let jpegs = await recorder.jpegs
    #expect(jpegs.count == 2)
    let first = try Pixels(jpeg: jpegs[0])
    let second = try Pixels(jpeg: jpegs[1])
    #expect(first[5, 960].isClose(to: .white, within: 4))
    #expect(second[5, 960].isClose(to: .gray, within: 4))
  }

  @Test func fertigReturnsToStartAndDeletesTheOriginals() async throws {
    let session = try await editingSession([try photo("a"), try photo("b"), try photo("c")])
    session.save()
    await finish(session)
    let copies = await recorder.copies
    #expect(copies.count == 3)
    #expect(copies.allSatisfy { FileManager.default.fileExists(atPath: $0.path) })

    session.close()

    #expect(session.phase.label == "start")
    #expect(copies.allSatisfy { !FileManager.default.fileExists(atPath: $0.path) })
  }

  @Test func removingAPhotoDeletesItsOriginal() async throws {
    let session = try await editingSession([try photo("a"), try photo("b")])
    let copies = await recorder.copies

    session.edit { $0.remove(0) }

    #expect(session.phase.document?.photos.map(\.id) == [1])
    #expect(!FileManager.default.fileExists(atPath: copies[0].path))
    #expect(FileManager.default.fileExists(atPath: copies[1].path))
  }

  @Test func canvasSpacingAndTheAllPhotosShapeAreRememberedForTheNextCollage() async throws {
    let first = try await editingSession([try photo("a"), try photo("b")])
    first.edit { $0.canvas = .landscape3x2 }
    first.edit { $0.spacing = CollageSpacing(clamping: 20) }
    first.edit { $0.setShapeOfAll(.square) }
    first.close()

    let second = try await editingSession([try photo("c"), try photo("d")])

    let document = try #require(second.phase.document)
    #expect(document.canvas == .landscape3x2)
    #expect(document.spacing.px == 20)
    #expect(document.photos.allSatisfy { $0.shape == .square })
  }

  @Test func orderAndSinglePhotoShapesAreNotRemembered() async throws {
    let first = try await editingSession([try photo("a"), try photo("b"), try photo("c")])
    first.edit { $0.move(0, to: 2) }
    first.edit { $0.setShape(.square, of: 1) }
    #expect(first.phase.document?.photos.map(\.id) == [1, 2, 0])
    first.close()

    let second = try await editingSession([try photo("d"), try photo("e"), try photo("f")])

    #expect(second.phase.document?.photos.map(\.id) == [0, 1, 2])
    #expect(second.phase.document?.photos.allSatisfy { $0.shape == .original } == true)
  }

  @Test func closingReturnsToStartFromEveryStateButSaving() async throws {
    let picking = makeSession()
    picking.openPicker()
    picking.close()
    #expect(picking.phase.label == "start")

    let loading = makeSession()
    loading.pick([StalledSource()])
    loading.close()
    #expect(loading.phase.label == "start")

    let nothingLoaded = makeSession()
    nothingLoaded.pick([try garbage("x")])
    await finish(nothingLoaded)
    #expect(nothingLoaded.phase.label == "nothingLoaded")
    nothingLoaded.close()
    #expect(nothingLoaded.phase.label == "start")

    let editing = try await editingSession([try photo("a")])
    editing.close()
    #expect(editing.phase.label == "start")
  }

  @Test(.timeLimit(.minutes(1)))
  func callsOutsideTheirStateChangeNothing() async throws {
    let another = try photo("x")

    let start = makeSession()
    start.retryLoading()
    start.save()
    start.edit { $0.canvas = .square }
    start.close()
    start.appBecameActive()
    #expect(start.phase.label == "start")
    #expect(start.worker == nil)

    start.openPicker()
    start.openPicker()
    start.retryLoading()
    start.save()
    #expect(start.phase.label == "picking")

    let held = StalledSource()
    let loading = makeSession()
    loading.pick([held])
    try await waitUntil { held.loads == 1 }
    loading.openPicker()
    loading.pick([another])
    loading.retryLoading()
    loading.save()
    loading.appBecameActive()
    #expect(loading.phase.label == "loading")
    #expect(held.loads == 1)
    loading.close()

    let nothingLoaded = makeSession()
    nothingLoaded.pick([try garbage("g")])
    await finish(nothingLoaded)
    nothingLoaded.openPicker()
    nothingLoaded.pick([another])
    nothingLoaded.save()
    #expect(nothingLoaded.phase.label == "nothingLoaded")

    let editing = try await editingSession([try photo("a")])
    editing.openPicker()
    editing.pick([another])
    editing.retryLoading()
    #expect(editing.phase.label == "editing")

    editing.save()
    await finish(editing)
    editing.openPicker()
    editing.pick([another])
    editing.retryLoading()
    editing.save()
    await finish(editing)
    #expect(editing.phase.label == "saved")

    let events = await recorder.events
    #expect(!events.contains("load x.jpeg"))
    let saved = await recorder.saved
    #expect(saved.count == 1)
  }

  private func makeSession(stallTimeout: Duration = .seconds(60)) -> CollageSession {
    CollageSession(library: recorder.library, settings: memory.store, stallTimeout: stallTimeout)
  }

  private func editingSession(_ sources: [FixtureSource]) async throws -> CollageSession {
    let session = makeSession()
    session.pick(sources)
    await finish(session)
    try #require(session.phase.label == "editing")
    return session
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

  private func finish(_ session: CollageSession) async {
    await session.worker?.value
  }
}

final class MemorySettings: Sendable {
  private let stored = Mutex(CollageSettings())

  var store: CollageSettingsStore {
    CollageSettingsStore(
      load: { self.stored.withLock { $0 } },
      save: { settings in self.stored.withLock { $0 = settings } })
  }
}

extension CollagePhase {
  var label: String {
    switch self {
    case .start: "start"
    case .picking: "picking"
    case .loading: "loading"
    case .nothingLoaded: "nothingLoaded"
    case .editing: "editing"
    case .saving: "saving"
    case .saved: "saved"
    }
  }

  var document: CollageDocument? {
    switch self {
    case .editing(let document, _), .saving(let document), .saved(let document): document
    case .start, .picking, .loading, .nothingLoaded: nil
    }
  }

  var notice: CollageNotice? {
    if case .editing(_, let notice) = self { notice } else { nil }
  }

  var finishedLoads: Int? {
    if case .loading(let load) = self { load.finished } else { nil }
  }
}
