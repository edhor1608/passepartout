import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers

@testable import PassepartoutKit

@Suite(.serialized)
struct CollageRendererTests {
  let directory: TestDirectory

  init() throws {
    directory = try TestDirectory()
  }

  @Test func drawsEachPhotoInItsCellOnWhite() async throws {
    let photos = [
      (RGB.red, 600, 400), (RGB.blue, 400, 600), (RGB(30, 160, 60), 500, 500), (RGB.gray, 900, 400),
    ]
    let document = try await loadedCollage(
      photos.map { color, width, height in try solid(color, width: width, height: height) },
      canvas: .portrait3x4, spacing: 40)

    let output = try Pixels(jpeg: try await renderCollage(document))

    #expect(output.width == 1440)
    #expect(output.height == 1920)
    let cells = document.layout.cells
    #expect(cells.count == photos.count)
    for (cell, photo) in zip(cells, photos) {
      let rect = cell.rect
      for point in inner(rect, inset: 3) + [(rect.x + rect.width / 2, rect.y + rect.height / 2)] {
        #expect(output[point].isClose(to: photo.0, within: 12), "\(rect) at \(point)")
      }
      let half = 20
      let around = [
        (rect.x - half, rect.y + rect.height / 2), (rect.x + rect.width - 1 + half, rect.y + 2),
        (rect.x + rect.width / 2, rect.y - half), (rect.x + 2, rect.y + rect.height - 1 + half),
      ]
      for point in around {
        #expect(output[point].isClose(to: .white, within: 4), "around \(rect) at \(point)")
      }
    }
    #expect(output[0, 0] == .white)
    #expect(output[output.width - 1, output.height - 1] == .white)
  }

  @Test func aSquareCellShowsTheCentreOfThePhoto() async throws {
    let source = try makeImage(width: 600, height: 400) { context in
      context.fill(CGRect(x: 0, y: 0, width: 600, height: 400), with: .gray)
      context.fill(CGRect(x: 100, y: 0, width: 400, height: 400), with: .blue)
    }
    var document = try await loadedCollage(
      [try directory.write(source, as: .jpeg)], canvas: .square, spacing: 57)
    document.setShape(.square, of: nil)

    let output = try Pixels(jpeg: try await renderCollage(document))

    let rect = try #require(document.layout.cells.first?.rect)
    #expect(rect.width == rect.height)
    let edges = [
      (rect.x + 3, rect.y + rect.height / 2), (rect.x + rect.width - 4, rect.y + rect.height / 2),
      (rect.x + rect.width / 2, rect.y + 3), (rect.x + rect.width / 2, rect.y + rect.height - 4),
    ]
    for point in inner(rect, inset: 3) + edges {
      #expect(output[point].isClose(to: .blue, within: 12), "\(point)")
    }
  }

  @Test(arguments: 1...8)
  func appliesTheExifOrientation(orientation: Int) async throws {
    let stored = try makeImage(width: 300, height: 200) { context in
      context.fill(CGRect(x: 0, y: 0, width: 300, height: 200), with: .gray)
      context.fill(CGRect(x: 0, y: 0, width: 60, height: 60), with: .red)
    }
    let url = try directory.write(stored, as: .jpeg, orientation: orientation)
    let document = try await loadedCollage([url], canvas: .portrait3x4, spacing: 57)

    let output = try Pixels(jpeg: try await renderCollage(document))

    let rect = try #require(document.layout.cells.first?.rect)
    #expect((rect.width > rect.height) == (orientation < 5))
    let expectedCorner = try #require(PhotoFramerTests.displayedCorner[orientation])
    let insetX = rect.width / 10
    let insetY = rect.height / 10
    let corners: [(PhotoFramerTests.Corner, (Int, Int))] = [
      (.topLeft, (rect.x + insetX, rect.y + insetY)),
      (.topRight, (rect.x + rect.width - 1 - insetX, rect.y + insetY)),
      (.bottomRight, (rect.x + rect.width - 1 - insetX, rect.y + rect.height - 1 - insetY)),
      (.bottomLeft, (rect.x + insetX, rect.y + rect.height - 1 - insetY)),
    ]
    for (corner, point) in corners {
      #expect(
        output[point].isClose(to: .red, within: 30) == (corner == expectedCorner), "\(corner)")
    }
  }

  @Test func scalesASmallPhotoUpToItsCell() async throws {
    let document = try await loadedCollage(
      [try solid(.blue, width: 200, height: 150)], canvas: .portrait3x4, spacing: 57)

    let output = try Pixels(jpeg: try await renderCollage(document))

    let rect = try #require(document.layout.cells.first?.rect)
    #expect(rect.width > 200)
    for point in inner(rect, inset: 3) {
      #expect(output[point].isClose(to: .blue, within: 12), "\(point)")
    }
  }

  @Test func keepsDetailThePreviewHasLost() async throws {
    let stripes = try makeImage(width: 1440, height: 1920) { context in
      context.fill(CGRect(x: 0, y: 0, width: 1440, height: 1920), with: .white)
      for x in stride(from: 0, to: 1440, by: 2) {
        context.fill(CGRect(x: x, y: 0, width: 1, height: 1920), with: RGB(0, 0, 0))
      }
    }
    let document = try await loadedCollage(
      [try directory.write(stripes, as: .png)], canvas: .portrait3x4, spacing: 0)

    let output = try Pixels(jpeg: try await renderCollage(document))

    let row = (600..<840).map { output[$0, 960].red }
    #expect(try #require(row.max()) - #require(row.min()) > 150)
  }

  @Test func writesABaselineSRGBJPEGWithoutSourceMetadata() async throws {
    let metadata = CGImageMetadataCreateMutable()
    #expect(
      CGImageMetadataSetValueMatchingImageProperty(
        metadata, kCGImagePropertyGPSDictionary, kCGImagePropertyGPSLatitude, -41.2865 as CFNumber))
    #expect(
      CGImageMetadataSetValueMatchingImageProperty(
        metadata, kCGImagePropertyTIFFDictionary, kCGImagePropertyTIFFModel,
        "CanaryModel" as CFString))
    #expect(
      CGImageMetadataSetValueWithPath(
        metadata, nil, "xmp:CreatorTool" as CFString, "CanaryTool" as CFString))
    let gray = try makeImage(width: 600, height: 400) { context in
      context.fill(CGRect(x: 0, y: 0, width: 600, height: 400), with: .gray)
    }
    let tagged = try directory.write(gray, as: .jpeg, metadata: metadata)
    #expect(try Data(contentsOf: tagged).range(of: Data("Canary".utf8)) != nil)
    let target = RGB(200, 100, 50)
    let displayP3 = try makeImage(width: 600, height: 400, colorSpace: CGColorSpace.displayP3) {
      context in
      context.fill(CGRect(x: 0, y: 0, width: 600, height: 400), with: target)
    }
    let document = try await loadedCollage(
      [tagged, try directory.write(displayP3, as: .png)], canvas: .square, spacing: 57)

    let jpeg = try await renderCollage(document)

    #expect(firstFrameMarker(jpeg) == 0xC0)
    #expect(jpeg.range(of: Data("Canary".utf8)) == nil)
    let encoded = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
    let properties = try #require(
      CGImageSourceCopyPropertiesAtIndex(encoded, 0, nil) as? [String: Any])
    #expect(properties["{GPS}"] == nil)
    #expect(properties["{TIFF}"] == nil)
    let image = try #require(CGImageSourceCreateImageAtIndex(encoded, 0, nil))
    #expect(image.colorSpace?.name == CGColorSpace.sRGB)
    let p3Cell = try #require(document.layout.cells.last?.rect)
    let centre = (p3Cell.x + p3Cell.width / 2, p3Cell.y + p3Cell.height / 2)
    #expect(try Pixels(image)[centre].isClose(to: target, within: 2))
  }

  @Test(arguments: [
    (4000, 3000, 1, 4000, 3000, 1000, 750), (4000, 3000, 6, 3000, 4000, 750, 1000),
    (600, 400, 1, 600, 400, 600, 400),
  ])
  func readsTheOrientedSizeAndAPreviewOfAtMost1000Pixels(
    width: Int, height: Int, orientation: Int, orientedWidth: Int, orientedHeight: Int,
    previewWidth: Int, previewHeight: Int
  ) async throws {
    let image = try makeImage(width: width, height: height) { context in
      context.fill(CGRect(x: 0, y: 0, width: width, height: height), with: .gray)
    }
    let url = try directory.write(image, as: .jpeg, orientation: orientation)

    let original = try await readOriginal(SourceFile(copying: url))

    #expect(original.pixelSize == PixelSize(width: orientedWidth, height: orientedHeight))
    #expect(original.preview.width == previewWidth)
    #expect(original.preview.height == previewHeight)
  }

  @Test func readingAFileImageIOCannotReadFails() async throws {
    let url = try directory.write(Data("not an image".utf8), named: "garbage.jpg")
    await #expect(throws: PhotoFailure.unreadable) {
      try await readOriginal(SourceFile(copying: url))
    }
  }

  @Test func renderingFailsWhenAnOriginalIsGone() async throws {
    let document = try collage([(600, 400)])
    await #expect(throws: PhotoFailure.unreadable) { try await renderCollage(document) }
  }

  private func solid(_ color: RGB, width: Int, height: Int) throws -> URL {
    let image = try makeImage(width: width, height: height) { context in
      context.fill(CGRect(x: 0, y: 0, width: width, height: height), with: color)
    }
    return try directory.write(image, as: .jpeg)
  }

  private func loadedCollage(_ urls: [URL], canvas: CollageCanvas, spacing: Int) async throws
    -> CollageDocument
  {
    var originals: [LoadedOriginal] = []
    for url in urls { originals.append(try await readOriginal(SourceFile(copying: url))) }
    var settings = CollageSettings()
    settings.canvas = canvas
    settings.spacing = CollageSpacing(clamping: spacing)
    return try #require(CollageDocument(originals: originals, settings: settings))
  }

  /// Points `inset` pixels inside each corner of `rect`.
  private func inner(_ rect: PixelRect, inset: Int) -> [(Int, Int)] {
    let right = rect.x + rect.width - 1 - inset
    let bottom = rect.y + rect.height - 1 - inset
    return [
      (rect.x + inset, rect.y + inset), (right, rect.y + inset), (right, bottom),
      (rect.x + inset, bottom),
    ]
  }
}
