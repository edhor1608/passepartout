import CoreTransferable
import Foundation
import Photos
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// One picked photo that can hand over its original: `PhotosPickerItem` in the app, synthetic
/// files in tests.
public protocol PhotoSource: Sendable {
  /// Starts the handover and returns its progress. `completion` gets `nil` when the item carries
  /// no image. Cancelling the progress abandons the transfer.
  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress
}

extension PhotosPickerItem: PhotoSource {
  /// The picker process downloads iCloud-only originals on demand; no library permission is
  /// involved. The stored encoding (HEIC, RAW, JPEG) arrives only when the picker uses
  /// `preferredItemEncoding: .current`. The async variant offers no progress and no way to give
  /// up on a stalled download.
  public func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    loadTransferable(type: SourceFile.self, completionHandler: completion)
  }
}

/// A copy of one picked original in `tmp/PickedOriginals/`. Releasing the object deletes the
/// file, so every exit from processing a photo cleans up, thrown errors included.
public final class SourceFile: Sendable {
  let url: URL
  let suggestedOutputName: String

  private static let directory = FileManager.default.temporaryDirectory.appending(
    path: "PickedOriginals", directoryHint: .isDirectory)

  /// The picker's file is only valid inside its import closure, so it is copied out.
  init(copying received: URL) throws {
    try FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
    let copy = Self.directory.appending(path: UUID().uuidString)
      .appendingPathExtension(received.pathExtension)
    try FileManager.default.copyItem(at: received, to: copy)
    url = copy
    suggestedOutputName = received.deletingPathExtension().lastPathComponent + "-passepartout.jpg"
  }

  deinit {
    try? FileManager.default.removeItem(at: url)
  }

  /// Deletes copies a killed process left behind. Call once at launch, before any session
  /// work, and never from tests, which run in parallel.
  public static func removeLeftovers() {
    try? FileManager.default.removeItem(at: directory)
  }
}

extension SourceFile: Transferable {
  public static var transferRepresentation: some TransferRepresentation {
    FileRepresentation(importedContentType: .image) { received in
      try SourceFile(copying: received.file)
    }
  }
}

/// Why the library refuses adds.
public enum LibraryBlocker: Equatable, Sendable {
  /// The user declined. Settings can change it.
  case denied
  /// Parental controls or device management. Settings cannot change it.
  case restricted

  static func blocking(_ status: PHAuthorizationStatus) -> LibraryBlocker? {
    switch status {
    case .authorized, .limited: nil
    case .restricted: .restricted
    case .denied, .notDetermined: .denied
    @unknown default: .denied
    }
  }
}

/// Add-only access to the Photos library, as two closures so tests can replace it.
public struct PhotoLibrary: Sendable {
  public var requestAddAccess: @Sendable () async -> LibraryBlocker?
  public var add: @Sendable (_ jpeg: Data, _ filename: String) async throws -> Void

  public init(
    requestAddAccess: @escaping @Sendable () async -> LibraryBlocker?,
    add: @escaping @Sendable (_ jpeg: Data, _ filename: String) async throws -> Void
  ) {
    self.requestAddAccess = requestAddAccess
    self.add = add
  }

  /// One `performChanges` per photo, so each save is atomic and a failure stays with its photo.
  /// The JPEG bytes land unchanged, and Photos dates the new asset "now", which puts the copies
  /// at the top of Recents where Instagram's picker opens.
  public static let system = PhotoLibrary(
    requestAddAccess: {
      LibraryBlocker.blocking(await PHPhotoLibrary.requestAuthorization(for: .addOnly))
    },
    add: { jpeg, filename in
      // PhotoKit runs this block on its own queue. Written in main-actor code it would be
      // inferred main-actor isolated and trap at runtime, so it must stay in this nonisolated
      // closure.
      try await PHPhotoLibrary.shared().performChanges {
        let options = PHAssetResourceCreationOptions()
        options.uniformTypeIdentifier = UTType.jpeg.identifier
        options.originalFilename = filename
        PHAssetCreationRequest.forAsset().addResource(with: .photo, data: jpeg, options: options)
      }
    }
  )
}
