import CoreTransferable
import Foundation
import Photos
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// One picked photo that can hand over its original: `LibraryPhoto` or `PhotosPickerItem` in the
/// app, synthetic files in tests.
public protocol PhotoSource: Sendable {
  /// Whether loading may start or continue while the app is in the background.
  var loadsInBackground: Bool { get }

  /// Starts the handover and returns its progress. `completion` gets `nil` when the item carries
  /// no image. Cancelling the progress abandons the transfer.
  func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress
}

extension PhotosPickerItem: PhotoSource {
  /// Each handover holds a file coordination claim on the app's background time, about 30
  /// seconds. iOS kills the app when a claim outlives that time, and a background task does not
  /// extend it.
  public var loadsInBackground: Bool { false }

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

/// A picked photo read straight from the library, which keeps working in the background and
/// reports real iCloud download progress. Needs read access to the photo.
public struct LibraryPhoto: PhotoSource {
  let localIdentifier: String

  public var loadsInBackground: Bool { true }

  /// Swaps each picker item the library hands over itself for a `LibraryPhoto`: all of them with
  /// full read access, those in the selection with limited access. One fetch for the whole pick.
  /// The picker must be created with `photoLibrary: .shared()`, or items carry no identifier.
  public static func preferred(_ sources: [any PhotoSource]) -> [any PhotoSource] {
    let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
    let ids = sources.compactMap { ($0 as? PhotosPickerItem)?.itemIdentifier }
    guard status == .authorized || status == .limited, !ids.isEmpty else { return sources }
    let assets = PHAsset.fetchAssets(withLocalIdentifiers: ids, options: nil)
    let readable = Set((0..<assets.count).map { assets.object(at: $0).localIdentifier })
    return sources.map { source in
      guard let id = (source as? PhotosPickerItem)?.itemIdentifier, readable.contains(id) else {
        return source
      }
      return LibraryPhoto(localIdentifier: id)
    }
  }

  /// Writes the current rendition, edits included, like the picker's `.current` encoding: the
  /// rendered full-size photo of an edited asset, the stored photo otherwise.
  public func loadOriginal(
    completion: @escaping @Sendable (Result<SourceFile?, any Error>) -> Void
  ) -> Progress {
    let progress = Progress(totalUnitCount: 1000)
    guard
      let asset = PHAsset.fetchAssets(withLocalIdentifiers: [localIdentifier], options: nil)
        .firstObject
    else {
      completion(.failure(CocoaError(.fileReadNoSuchFile)))
      return progress
    }
    let resources = PHAssetResource.assetResources(for: asset)
    let stored = resources.first { $0.type == .photo }
    guard let rendition = resources.first(where: { $0.type == .fullSizePhoto }) ?? stored else {
      completion(.success(nil))
      return progress
    }
    // An edited asset's rendition is named FullSizeRender, so the name comes from the original.
    let name = (stored ?? rendition).originalFilename
    let destination: URL
    do {
      destination = try SourceFile.newURL(
        pathExtension: (rendition.originalFilename as NSString).pathExtension)
    } catch {
      completion(.failure(error))
      return progress
    }
    let options = PHAssetResourceRequestOptions()
    options.isNetworkAccessAllowed = true
    options.progressHandler = { fraction in progress.completedUnitCount = Int64(fraction * 1000) }
    PHAssetResourceManager.default().writeData(
      for: rendition, toFile: destination, options: options
    ) {
      error in
      if let error {
        try? FileManager.default.removeItem(at: destination)
        completion(.failure(error))
      } else {
        completion(.success(SourceFile(owning: destination, originalName: name)))
      }
    }
    return progress
  }
}

/// A copy of one picked original in `tmp/PickedOriginals/`. Releasing the object deletes the
/// file, so every exit from processing a photo cleans up, thrown errors included.
public final class SourceFile: Sendable {
  let url: URL
  let suggestedOutputName: String

  private static let directory = FileManager.default.temporaryDirectory.appending(
    path: "PickedOriginals", directoryHint: .isDirectory)

  /// Takes over a file at a URL from `newURL(pathExtension:)`.
  init(owning url: URL, originalName: String) {
    self.url = url
    suggestedOutputName = (originalName as NSString).deletingPathExtension + "-passepartout.jpg"
  }

  /// The picker's file is only valid inside its import closure, so it is copied out.
  convenience init(copying received: URL) throws {
    let copy = try Self.newURL(pathExtension: received.pathExtension)
    try FileManager.default.copyItem(at: received, to: copy)
    self.init(owning: copy, originalName: received.lastPathComponent)
  }

  static func newURL(pathExtension: String) throws -> URL {
    try FileManager.default.createDirectory(at: Self.directory, withIntermediateDirectories: true)
    return Self.directory.appending(path: UUID().uuidString).appendingPathExtension(pathExtension)
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
