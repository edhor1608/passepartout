import CoreGraphics
import Foundation
import Observation
import Synchronization

/// Picked photos in, framed copies in the library out.
///
/// One serial runner frames and saves photos in pick order, so the library order matches the
/// pick and at most one decode is in memory.
@MainActor
@Observable
public final class FramingSession {
  public private(set) var photos: [Photo] = []
  /// Set while the library refuses adds. Queued photos wait for `recheckAccess()`.
  public private(set) var blocker: LibraryBlocker?
  /// Set by `pause()` during a run. The photo in flight still finishes, and queued photos wait
  /// for `resume()`, `add` or `retryFailed`. Clears itself once no photo is left queued.
  public private(set) var isPaused = false
  public var isRunning: Bool { runner != nil }
  public var summary: Summary { Summary(photos) }

  private(set) var runner: Task<Void, Never>?
  private let library: PhotoLibrary
  private let stallTimeout: Duration
  private var nextID = 0

  /// `stallTimeout` is how long a transfer may report no progress before its photo fails.
  public init(library: PhotoLibrary = .system, stallTimeout: Duration = .seconds(60)) {
    self.library = library
    self.stallTimeout = stallTimeout
  }

  /// Adding during a run extends it. Adding after a finished batch starts a new one and keeps
  /// only the failures a retry can still fix.
  public func add(_ sources: [any PhotoSource]) {
    guard !sources.isEmpty else { return }
    if summary.inProgress == 0 { photos.removeAll { $0.state.failure?.isRetryable != true } }
    for source in sources {
      photos.append(Photo(id: nextID, state: .queued, source: source))
      nextID += 1
    }
    continueQueue()
  }

  /// Requeues failures that can succeed on a second try. Unreadable and too-small photos stay.
  public func retryFailed() {
    for index in photos.indices where photos[index].state.failure?.isRetryable == true {
      photos[index].state = .queued
    }
    continueQueue()
  }

  /// Continues a paused batch. Call it only on the user's tap, so a stop in system UI holds
  /// until the user lifts it.
  public func resume() {
    continueQueue()
  }

  /// Lets the photo in flight finish and keeps the rest queued until the next `add`,
  /// `retryFailed` or `resume`. For when iOS or the user stops the batch's background task.
  public func pause() {
    guard isRunning else { return }
    isPaused = true
  }

  /// Call when the app becomes active: asks the library again while it refuses adds, since the
  /// user may have allowed them in Settings. A pause stays.
  public func recheckAccess() {
    guard blocker != nil else { return }
    continueQueue()
  }

  private func continueQueue() {
    isPaused = false
    guard runner == nil, photos.contains(where: { $0.state == .queued }) else { return }
    runner = Task {
      await drain()
      runner = nil
    }
  }

  private func drain() async {
    blocker = await library.requestAddAccess()
    guard blocker == nil else { return }
    while let photo = photos.first(where: { $0.state == .queued }) {
      guard !isPaused else { return }
      await process(photo)
    }
    isPaused = false
  }

  private func process(_ photo: Photo) async {
    do throws(PhotoFailure) {
      set(photo.id, .loading(fraction: nil))
      let file = try await load(photo)
      set(photo.id, .framing)
      let framed = try await framePhoto(file, borderPx: defaultBorderPx)
      set(photo.id, .saving)
      do {
        try await library.add(framed.jpeg, file.suggestedOutputName)
      } catch {
        throw .notSaved
      }
      set(photo.id, .saved(preview: framed.preview))
    } catch {
      set(photo.id, .failed(error))
    }
  }

  private func load(_ photo: Photo) async throws(PhotoFailure) -> SourceFile {
    let result = await withCheckedContinuation { continuation in
      let handover = Handover(continuation)
      let progress = photo.source.loadOriginal { handover.finish($0) }
      Task { await watch(progress, of: photo.id, until: handover) }
    }
    switch result {
    case .success(let file?): return file
    case .success(nil): throw .unreadable
    case .failure(let error): throw isOutOfSpace(error) ? .storageFull : .notLoaded
    }
  }

  private func watch(_ progress: Progress, of id: Photo.ID, until handover: Handover) async {
    let poll = min(.milliseconds(500), stallTimeout / 4)
    var fraction = progress.fractionCompleted
    var unchanged = Duration.zero
    while !handover.isFinished {
      try? await Task.sleep(for: poll)
      guard progress.fractionCompleted == fraction else {
        fraction = progress.fractionCompleted
        unchanged = .zero
        showLoading(id, fraction: progress.isIndeterminate ? nil : fraction)
        continue
      }
      unchanged += poll
      if unchanged >= stallTimeout, handover.finish(.failure(TransferStalled())) {
        progress.cancel()
      }
    }
  }

  private func showLoading(_ id: Photo.ID, fraction: Double?) {
    guard let index = photos.firstIndex(where: { $0.id == id }),
      case .loading = photos[index].state
    else { return }
    photos[index].state = .loading(fraction: fraction)
  }

  private func set(_ id: Photo.ID, _ state: Photo.State) {
    guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
    photos[index].state = state
  }
}

public struct Photo: Identifiable, Sendable {
  public enum State: Equatable, Sendable {
    case queued
    /// Fetching the original from Photos, which may download it from iCloud. `fraction` is
    /// `nil` until the transfer reports one.
    case loading(fraction: Double?)
    case framing
    case saving
    case saved(preview: CGImage)
    case failed(PhotoFailure)

    public var preview: CGImage? {
      if case .saved(let preview) = self { preview } else { nil }
    }

    public var failure: PhotoFailure? {
      if case .failed(let failure) = self { failure } else { nil }
    }

    var completedUnits: Int64 {
      switch self {
      case .queued: 0
      case .loading(let fraction?) where fraction > 0: Int64(80 * min(fraction, 1))
      case .loading: 0
      case .framing: 80
      case .saving: 90
      case .saved, .failed: 100
      }
    }
  }

  public let id: Int
  public fileprivate(set) var state: State
  fileprivate let source: any PhotoSource
}

/// Why one photo did not make it into the library.
public enum PhotoFailure: Error, Equatable, Sendable {
  /// Photos could not hand over the original, for example an iCloud photo while offline.
  case notLoaded
  /// The iPhone had no space left for the copy of the original.
  case storageFull
  /// The file is not an image ImageIO can read.
  case unreadable
  /// Smaller than the border allows.
  case tooSmall
  /// Decoding, resampling or encoding failed, usually under memory pressure.
  case renderFailed
  /// The library rejected the new photo.
  case notSaved

  public var isRetryable: Bool {
    switch self {
    case .notLoaded, .storageFull, .renderFailed, .notSaved: true
    case .unreadable, .tooSmall: false
    }
  }
}

public struct Summary: Equatable, Sendable {
  public let total: Int
  public let saved: Int
  public let failed: Int
  public let retryable: Int
  /// Progress in hundredths of a photo: 100 for each finished photo, saved or failed, and part
  /// of 100 for the photo in flight, so a long download moves it before any photo finishes.
  public let completedUnits: Int64
  public var totalUnits: Int64 { Int64(total) * 100 }
  public var inProgress: Int { total - saved - failed }

  init(_ photos: [Photo]) {
    total = photos.count
    saved = photos.count { $0.state.preview != nil }
    failed = photos.count { $0.state.failure != nil }
    retryable = photos.count { $0.state.failure?.isRetryable == true }
    completedUnits = photos.reduce(0) { $0 + $1.state.completedUnits }
  }
}

private final class Handover: Sendable {
  private let continuation: Mutex<CheckedContinuation<Result<SourceFile?, any Error>, Never>?>

  init(_ continuation: CheckedContinuation<Result<SourceFile?, any Error>, Never>) {
    self.continuation = Mutex(continuation)
  }

  var isFinished: Bool { continuation.withLock { $0 == nil } }

  @discardableResult
  func finish(_ result: Result<SourceFile?, any Error>) -> Bool {
    guard let continuation = continuation.withLock({ $0.take() }) else { return false }
    continuation.resume(returning: result)
    return true
  }
}

private struct TransferStalled: Error {}

private func isOutOfSpace(_ error: any Error) -> Bool {
  switch error {
  case let error as CocoaError where error.code == .fileWriteOutOfSpace: true
  case let error as POSIXError where error.code == .ENOSPC: true
  default: (error as NSError).underlyingErrors.contains(where: isOutOfSpace)
  }
}
