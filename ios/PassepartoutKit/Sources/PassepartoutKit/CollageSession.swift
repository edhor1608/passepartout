import Foundation
import Observation

public enum CollagePhase: Sendable {
  case start
  case picking
  case loading(CollageLoad)
  /// Every picked photo failed to load.
  case nothingLoaded(CollageLoad)
  case editing(CollageDocument, notice: CollageNotice?)
  /// Edits wait until the library answered.
  case saving(CollageDocument)
  /// Exactly this document is in the library. An edit that changes it returns to `editing`.
  case saved(CollageDocument)
}

/// A pick on its way into a document. The queue lives here, so the phase is the whole state and a
/// load that waited for the app continues from it.
public struct CollageLoad: Sendable {
  public var total: Int { sources.count }
  /// Loaded or dropped so far.
  public internal(set) var finished = 0
  let sources: [any PhotoSource]
  var loaded: [LoadedOriginal] = []
  /// Set while the next photo needs the app on screen and it is not.
  var waitsForApp = false
}

public enum CollageNotice: Equatable, Sendable {
  /// Some picked photos did not load and are not in the collage.
  case photosDropped(Int)
  case notSaved(PhotoFailure)
  case libraryBlocked(LibraryBlocker)
}

/// Picked photos in, one collage in the library out.
///
/// Every call outside its state does nothing, so each is safe to repeat. A load or save that
/// finishes after the user moved on never changes the phase.
@MainActor
@Observable
public final class CollageSession {
  public private(set) var phase = CollagePhase.start

  /// The load or save in flight, for tests to await.
  private(set) var worker: Task<Void, Never>?
  private let library: PhotoLibrary
  private let settings: CollageSettingsStore
  private let stallTimeout: Duration
  /// Counts entered phases. A load remembers the count it started under and drops its result
  /// once the count moved on.
  private var run = 0
  private var transfer: OriginalTransfer?
  private var isInBackground = false

  /// `stallTimeout` is how long a transfer may report no progress before its photo is dropped.
  public init(
    library: PhotoLibrary = .system, settings: CollageSettingsStore = .userDefaults(),
    stallTimeout: Duration = .seconds(60)
  ) {
    self.library = library
    self.settings = settings
    self.stallTimeout = stallTimeout
  }

  public func openPicker() {
    guard case .start = phase else { return }
    enter(.picking)
  }

  /// The picker's result, at most `CollageDocument.maxPhotoCount` of it. Taking a pick in `start`
  /// too makes the order in which SwiftUI reports the dismissal and the selection irrelevant.
  public func pick(_ sources: [any PhotoSource]) {
    switch phase {
    case .start, .picking: break
    default: return
    }
    guard !sources.isEmpty else {
      if case .picking = phase { enter(.start) }
      return
    }
    startLoading(CollageLoad(sources: Array(sources.prefix(CollageDocument.maxPhotoCount))))
  }

  /// Loads the same pick again.
  public func retryLoading() {
    guard case .nothingLoaded(let failed) = phase else { return }
    startLoading(CollageLoad(sources: failed.sources))
  }

  /// Changes the document while it is in the editor or saved. A change clears the notice, ends
  /// `saved` and stores settings that changed for the next collage.
  public func edit(_ change: (inout CollageDocument) -> Void) {
    let document: CollageDocument
    switch phase {
    case .editing(let current, _), .saved(let current): document = current
    default: return
    }
    var edited = document
    change(&edited)
    guard edited != document else { return }
    if edited.settings != document.settings { settings.save(edited.settings) }
    enter(.editing(edited, notice: nil))
  }

  /// Renders the document and adds it to the library. Nothing leaves `saving` but its result, so
  /// a double tap adds one photo.
  public func save() {
    guard case .editing(let document, _) = phase else { return }
    enter(.saving(document))
    worker = Task { enter(await store(document)) }
  }

  /// Cancel and "Fertig". Ignored while saving.
  public func close() {
    switch phase {
    case .start, .saving: return
    default: enter(.start)
    }
  }

  /// Continues a load that waited for the app.
  public func appBecameActive() {
    isInBackground = false
    guard case .loading(var load) = phase, load.waitsForApp else { return }
    load.waitsForApp = false
    startLoading(load)
  }

  /// Gives up a handover that cannot run in the background, since iOS kills an app whose picker
  /// handover outlives its background time. Its photo loads again once the app is back.
  public func appMovedToBackground() {
    isInBackground = true
    if let transfer, !transfer.loadsInBackground { transfer.abandon() }
  }

  /// The one place a new phase begins. Whatever was in flight is stale from here on.
  @discardableResult
  private func enter(_ next: CollagePhase) -> Int {
    run += 1
    transfer?.abandon()
    transfer = nil
    phase = next
    return run
  }

  private func startLoading(_ load: CollageLoad) {
    let started = enter(.loading(load))
    worker = Task { await drain(started) }
  }

  private func drain(_ started: Int) async {
    while started == run, case .loading(var load) = phase {
      guard load.finished < load.total else {
        finishLoading(load)
        return
      }
      let source = load.sources[load.finished]
      guard !isInBackground || source.loadsInBackground else {
        load.waitsForApp = true
        phase = .loading(load)
        return
      }
      let outcome = await read(source)
      guard started == run else { return }
      switch outcome {
      // The loop parks it while the app is away, or retries it once the app is back.
      case .abandoned: continue
      case .loaded(let original): load.loaded.append(original)
      case .dropped: break
      }
      load.finished += 1
      phase = .loading(load)
    }
  }

  private enum ReadOutcome {
    case loaded(LoadedOriginal)
    case dropped
    case abandoned
  }

  private func read(_ source: any PhotoSource) async -> ReadOutcome {
    let transfer = OriginalTransfer(source, stallTimeout: stallTimeout)
    self.transfer = transfer
    do throws(PhotoFailure) {
      guard let file = try await transfer.file() else { return .abandoned }
      return .loaded(try await readOriginal(file))
    } catch {
      return .dropped
    }
  }

  private func finishLoading(_ load: CollageLoad) {
    guard let document = CollageDocument(originals: load.loaded, settings: settings.load()) else {
      enter(.nothingLoaded(load))
      return
    }
    let dropped = load.total - load.loaded.count
    enter(.editing(document, notice: dropped > 0 ? .photosDropped(dropped) : nil))
  }

  private func store(_ document: CollageDocument) async -> CollagePhase {
    if let blocker = await library.requestAddAccess() {
      return .editing(document, notice: .libraryBlocked(blocker))
    }
    do throws(PhotoFailure) {
      let jpeg = try await renderCollage(document)
      do {
        try await library.add(jpeg, "Collage-passepartout.jpg")
      } catch {
        throw .notSaved
      }
    } catch {
      return .editing(document, notice: .notSaved(error))
    }
    return .saved(document)
  }
}
