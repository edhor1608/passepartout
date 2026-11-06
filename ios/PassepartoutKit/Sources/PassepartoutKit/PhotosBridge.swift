// The boundary to the Photos system: picker input, temp-file ownership, add-only output.
// Photos types are parsed into kit types here; the session never sees PhotoKit.

import CoreTransferable
import Foundation
import UniformTypeIdentifiers

/// A copy of one picked original in `tmp/PickedOriginals/`. Releasing the object deletes the
/// file, so every exit from processing a photo cleans up, thrown errors included.
public final class SourceFile: Sendable {
  let url: URL
  /// "IMG_1234-passepartout.jpg", so the copy is easy to match with its original.
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
