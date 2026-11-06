/// Why one photo did not make it into the library.
public enum PhotoFailure: Error, Equatable, Sendable {
  /// Photos could not hand over the original, for example an iCloud photo while offline.
  case notLoaded
  /// ImageIO cannot read the file.
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
