import CoreGraphics
import Foundation
import Testing

@testable import PassepartoutKit

struct CollageDocumentTests {
  @Test func startsWithTheGivenSettingsAndThePhotosInPickOrder() throws {
    var settings = CollageSettings()
    settings.canvas = .square
    settings.spacing = CollageSpacing(clamping: 20)
    settings.shape = .square

    let document = try #require(
      CollageDocument(originals: try stubOriginals(3), settings: settings))

    #expect(document.settings == settings)
    #expect(document.photos.map(\.id) == [0, 1, 2])
    #expect(document.photos.allSatisfy { $0.shape == .square })
    #expect(document.uniformShape == .square)
  }

  @Test(arguments: [0, 13])
  func refusesAnythingButOneToTwelvePhotos(count: Int) throws {
    #expect(
      CollageDocument(originals: try stubOriginals(count), settings: CollageSettings()) == nil)
  }

  @Test(arguments: [1, 12])
  func acceptsOneToTwelvePhotos(count: Int) throws {
    let document = CollageDocument(originals: try stubOriginals(count), settings: CollageSettings())
    #expect(document?.photos.count == count)
  }

  @Test func movingChangesOnlyTheOrder() throws {
    var document = try collage(Array(repeating: (600, 400), count: 4))
    document.setShape(.square, of: 2)

    document.move(0, to: 2)
    #expect(document.photos.map(\.id) == [1, 2, 0, 3])
    document.move(3, to: -4)
    #expect(document.photos.map(\.id) == [3, 1, 2, 0])
    document.move(1, to: 99)
    #expect(document.photos.map(\.id) == [3, 2, 0, 1])

    #expect(document.photos.map(\.shape) == [.original, .square, .original, .original])
  }

  @Test func theLastPhotoCannotBeRemoved() throws {
    var document = try collage([(600, 400), (400, 600)])
    #expect(document.canRemove)

    document.remove(0)
    #expect(document.photos.map(\.id) == [1])
    #expect(!document.canRemove)

    document.remove(1)
    #expect(document.photos.map(\.id) == [1])
  }

  @Test func settingAllShapesOverridesSinglePhotosAndIsRemembered() throws {
    var document = try collage([(600, 400), (400, 600), (500, 500)])
    document.setShape(.square, of: 1)

    document.setShapeOfAll(.square)
    #expect(document.photos.allSatisfy { $0.shape == .square })
    #expect(document.settings.shape == .square)
    #expect(document.uniformShape == .square)

    document.setShape(.original, of: 0)
    document.setShapeOfAll(.original)
    #expect(document.photos.allSatisfy { $0.shape == .original })
    #expect(document.settings.shape == .original)
    #expect(document.uniformShape == .original)
  }

  @Test func aSinglePhotoShapeIsNotRemembered() throws {
    var document = try collage([(600, 400), (400, 600), (500, 500)])

    document.setShape(.square, of: 1)

    #expect(document.photos.map(\.shape) == [.original, .square, .original])
    #expect(document.settings.shape == .original)
    #expect(document.uniformShape == nil)
    let cell = try #require(document.layout.cells.first { $0.id == 1 })
    #expect(abs(cell.rect.width - cell.rect.height) <= 1, "\(cell.rect)")
  }

  @Test func unknownIdsChangeNothing() throws {
    let document = try collage([(600, 400), (400, 600)])
    var edited = document

    edited.move(7, to: 0)
    edited.setShape(.square, of: 7)
    edited.remove(7)
    #expect(edited == document)

    edited.move(1, to: 0)
    #expect(edited != document)
  }
}

func stubOriginal(width: Int, height: Int) throws -> LoadedOriginal {
  let unused = FileManager.default.temporaryDirectory.appending(path: "stub-\(UUID().uuidString)")
  return LoadedOriginal(
    file: SourceFile(owning: unused, originalName: "stub.jpg"),
    pixelSize: PixelSize(width: width, height: height),
    preview: try makeImage(width: 1, height: 1) { _ in })
}

func stubOriginals(_ count: Int) throws -> [LoadedOriginal] {
  try (0..<count).map { _ in try stubOriginal(width: 600, height: 400) }
}

func collage(
  _ sizes: [(Int, Int)], canvas: CollageCanvas = .portrait3x4, spacing: Int = 57,
  shape: CollageShape = .original
) throws -> CollageDocument {
  var settings = CollageSettings()
  settings.canvas = canvas
  settings.spacing = CollageSpacing(clamping: spacing)
  settings.shape = shape
  let originals = try sizes.map { try stubOriginal(width: $0.0, height: $0.1) }
  return try #require(CollageDocument(originals: originals, settings: settings))
}
