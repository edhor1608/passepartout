import CoreGraphics

/// Width over height of a cell, always within 1:5...5:1. `CollageLayout` needs the bound to
/// guarantee a layout, so a wider panorama is centre-cropped to it.
struct AspectRatio: Equatable, Sendable {
  static let limit = 5.0
  static let square = AspectRatio(clamping: PixelSize(width: 1, height: 1))

  let value: Double

  init(clamping size: PixelSize) {
    value = min(max(Double(size.width) / Double(size.height), 1 / Self.limit), Self.limit)
  }
}

/// Holding `file` keeps the copy of the original on disk.
struct LoadedOriginal: Sendable {
  let file: SourceFile
  /// After the EXIF orientation.
  let pixelSize: PixelSize
  let preview: CGImage
}

public struct CollagePhoto: Identifiable, Equatable, Sendable {
  /// The position in the pick. Stable while the collage lives, whatever the order becomes.
  public let id: Int
  public internal(set) var shape: CollageShape
  let original: LoadedOriginal

  public var preview: CGImage { original.preview }

  var cellAspect: AspectRatio {
    shape == .square ? .square : AspectRatio(clamping: original.pixelSize)
  }

  public static func == (lhs: CollagePhoto, rhs: CollagePhoto) -> Bool {
    lhs.id == rhs.id && lhs.shape == rhs.shape && lhs.original.file === rhs.original.file
  }
}

/// One collage: 1...12 photos with unique ids, their order and shapes, and the settings. No
/// method can break that. The last copy going away deletes the copies of the originals.
public struct CollageDocument: Equatable, Sendable {
  public static let maxPhotoCount = 12

  /// In the user's order: left to right, top to bottom.
  public private(set) var photos: [CollagePhoto]
  public private(set) var settings: CollageSettings

  public var canvas: CollageCanvas {
    get { settings.canvas }
    set { settings.canvas = newValue }
  }

  public var spacing: CollageSpacing {
    get { settings.spacing }
    set { settings.spacing = newValue }
  }

  /// The shape all photos share, `nil` when they differ.
  public var uniformShape: CollageShape? {
    let shape = photos.first?.shape
    return photos.allSatisfy { $0.shape == shape } ? shape : nil
  }

  public var canRemove: Bool { photos.count > 1 }

  public var layout: CollageLayout { CollageLayout(self) }

  /// `nil` unless there are 1...12 originals. Every photo starts with `settings.shape`.
  init?(originals: [LoadedOriginal], settings: CollageSettings) {
    guard (1...Self.maxPhotoCount).contains(originals.count) else { return nil }
    photos = originals.enumerated().map { index, original in
      CollagePhoto(id: index, shape: settings.shape, original: original)
    }
    self.settings = settings
  }

  /// Puts the photo at `index` in the order, clamped to the valid range. An unknown id does
  /// nothing, here and below.
  public mutating func move(_ id: CollagePhoto.ID, to index: Int) {
    guard let from = photos.firstIndex(where: { $0.id == id }) else { return }
    let photo = photos.remove(at: from)
    photos.insert(photo, at: min(max(index, 0), photos.count))
  }

  /// The shape of one photo, or of all photos for `nil`, which is `uniformShape`.
  public func shape(of id: CollagePhoto.ID?) -> CollageShape? {
    guard let id else { return uniformShape }
    return photos.first { $0.id == id }?.shape
  }

  /// Sets the shape of one photo, or of all photos for `nil`. Only `nil` also sets
  /// `settings.shape`, which a new collage starts with.
  public mutating func setShape(_ shape: CollageShape, of id: CollagePhoto.ID?) {
    guard let id else {
      for index in photos.indices { photos[index].shape = shape }
      settings.shape = shape
      return
    }
    guard let index = photos.firstIndex(where: { $0.id == id }) else { return }
    photos[index].shape = shape
  }

  /// Does nothing for the last photo.
  public mutating func remove(_ id: CollagePhoto.ID) {
    guard canRemove else { return }
    photos.removeAll { $0.id == id }
  }
}
