import CoreGraphics
import Foundation
import Observation

/// Picked photos in, framed copies in the library out.
///
/// The only writer of photo state. One serial runner frames and saves photos in pick order,
/// so the library order matches the pick and at most one decode is in memory.
@MainActor
@Observable
public final class FramingSession {
  public private(set) var photos: [Photo] = []
  /// Set while the library refuses adds. Queued photos wait for `resume()`.
  public private(set) var blocker: LibraryBlocker?
  public var isRunning: Bool { runner != nil }
  public var summary: Summary { Summary(photos) }

  private(set) var runner: Task<Void, Never>?
  private let library: PhotoLibrary
  private var nextID = 0

  public init(library: PhotoLibrary = .system) {
    self.library = library
  }

  /// Adding during a run extends it. Adding after a finished batch starts a new one.
  public func add(_ sources: [some PhotoSource]) {
    guard !sources.isEmpty else { return }
    if summary.inProgress == 0 { photos.removeAll() }
    for source in sources {
      photos.append(Photo(id: nextID, state: .queued, source: source))
      nextID += 1
    }
    startRunnerIfIdle()
  }

  /// Requeues failures that can succeed on a second try. Unreadable and too-small photos stay.
  public func retryFailed() {
    for index in photos.indices where photos[index].state.failure?.isRetryable == true {
      photos[index].state = .queued
    }
    startRunnerIfIdle()
  }

  /// Call when the app becomes active: asks the library again and continues queued work.
  public func resume() {
    startRunnerIfIdle()
  }

  private func startRunnerIfIdle() {
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
      await process(photo)
    }
  }

  private func process(_ photo: Photo) async {
    do throws(PhotoFailure) {
      set(photo.id, .loading)
      let file = try await load(photo.source)
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

  private func load(_ source: any PhotoSource) async throws(PhotoFailure) -> SourceFile {
    let file: SourceFile?
    do {
      file = try await source.loadOriginal()
    } catch {
      throw .notLoaded
    }
    guard let file else { throw .unreadable }
    return file
  }

  private func set(_ id: Photo.ID, _ state: Photo.State) {
    guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
    photos[index].state = state
  }
}

public struct Photo: Identifiable, Sendable {
  public enum State: Equatable, Sendable {
    case queued
    /// Fetching the original from Photos, which may download it from iCloud.
    case loading
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
  }

  public let id: Int
  public fileprivate(set) var state: State
  fileprivate let source: any PhotoSource
}

/// Why one photo did not make it into the library.
public enum PhotoFailure: Error, Equatable, Sendable {
  /// Photos could not hand over the original, for example an iCloud photo while offline.
  case notLoaded
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
    case .notLoaded, .renderFailed, .notSaved: true
    case .unreadable, .tooSmall: false
    }
  }
}

/// Counts derived from `photos` on every read, so there is no second copy to keep in sync.
public struct Summary: Equatable, Sendable {
  public let total: Int
  public let saved: Int
  public let failed: Int
  public let retryable: Int
  public var inProgress: Int { total - saved - failed }

  init(_ photos: [Photo]) {
    total = photos.count
    saved = photos.count { $0.state.preview != nil }
    failed = photos.count { $0.state.failure != nil }
    retryable = photos.count { $0.state.failure?.isRetryable == true }
  }
}
