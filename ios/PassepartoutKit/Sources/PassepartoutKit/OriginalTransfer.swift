import Foundation
import Synchronization

/// One original on its way out of Photos, with a stall timeout and a way to give up on it.
@MainActor
final class OriginalTransfer {
  let loadsInBackground: Bool
  private let source: any PhotoSource
  private let stallTimeout: Duration
  private let onProgress: @MainActor (Double?) -> Void
  private var running: (handover: Handover, progress: Progress)?

  /// `stallTimeout` is how long the transfer may report no progress before it fails.
  /// `onProgress` gets the fraction each time it changes, `nil` while the transfer reports none.
  init(
    _ source: any PhotoSource, stallTimeout: Duration,
    onProgress: @escaping @MainActor (Double?) -> Void = { _ in }
  ) {
    self.source = source
    self.stallTimeout = stallTimeout
    self.onProgress = onProgress
    loadsInBackground = source.loadsInBackground
  }

  /// The original, or `nil` after `abandon()`. Throws `.notLoaded` when the transfer failed or
  /// stalled, `.storageFull`, and `.unreadable` when the item carries no image.
  func file() async throws(PhotoFailure) -> SourceFile? {
    let result = await withCheckedContinuation { continuation in
      let handover = Handover(continuation)
      let progress = source.loadOriginal { handover.finish($0) }
      running = (handover, progress)
      Task { await watch(progress, until: handover) }
    }
    running = nil
    switch result {
    case .success(let file?): return file
    case .success(nil): throw .unreadable
    case .failure(let error) where error is Abandoned: return nil
    case .failure(let error): throw isOutOfSpace(error) ? .storageFull : .notLoaded
    }
  }

  /// Gives the transfer up and cancels its progress. A file that still arrives is deleted.
  func abandon() {
    if let running, running.handover.finish(.failure(Abandoned())) {
      running.progress.cancel()
    }
  }

  private func watch(_ progress: Progress, until handover: Handover) async {
    let poll = min(.milliseconds(500), stallTimeout / 4)
    var fraction = progress.fractionCompleted
    var unchanged = Duration.zero
    while !handover.isFinished {
      try? await Task.sleep(for: poll)
      guard progress.fractionCompleted == fraction else {
        fraction = progress.fractionCompleted
        unchanged = .zero
        onProgress(progress.isIndeterminate ? nil : fraction)
        continue
      }
      unchanged += poll
      if unchanged >= stallTimeout, handover.finish(.failure(TransferStalled())) {
        progress.cancel()
      }
    }
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

private struct Abandoned: Error {}

private func isOutOfSpace(_ error: any Error) -> Bool {
  switch error {
  case let error as CocoaError where error.code == .fileWriteOutOfSpace: true
  case let error as POSIXError where error.code == .ENOSPC: true
  default: (error as NSError).underlyingErrors.contains(where: isOutOfSpace)
  }
}
