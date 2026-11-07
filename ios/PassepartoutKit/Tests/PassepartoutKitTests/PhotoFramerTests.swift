import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers

@testable import PassepartoutKit

// The iOS simulator deadlocks once as many HEIC encodes run at once as it has CPU cores.
@Suite(.serialized)
struct PhotoFramerTests {
  enum Corner: CaseIterable {
    case topLeft, topRight, bottomRight, bottomLeft
  }

  static let displayedCorner: [Int: Corner] = [
    1: .topLeft, 2: .topRight, 3: .bottomRight, 4: .bottomLeft,
    5: .topLeft, 6: .topRight, 7: .bottomRight, 8: .bottomLeft,
  ]

  @Test(arguments: [UTType.jpeg, .heic, .png], 1...8)
  func appliesTheExifOrientation(type: UTType, orientation: Int) async throws {
    let directory = try TestDirectory()
    let stored = try makeImage(width: 300, height: 200) { context in
      context.fill(CGRect(x: 0, y: 0, width: 300, height: 200), with: .gray)
      context.fill(CGRect(x: 0, y: 0, width: 60, height: 60), with: .red)
    }
    let url = try directory.write(stored, as: type, orientation: orientation)

    let output = try Pixels(jpeg: try await framed(url).jpeg)

    let rotated = orientation >= 5
    #expect((output.width > output.height) == !rotated)
    let layout = try FrameLayout(
      sourceWidth: rotated ? 200 : 300, sourceHeight: rotated ? 300 : 200,
      borderPx: defaultBorderPx)
    let expectedCorner = try #require(Self.displayedCorner[orientation])
    for corner in Corner.allCases {
      let pixel = output[point(in: layout, near: corner)]
      #expect(pixel.isClose(to: .red, within: 30) == (corner == expectedCorner), "\(corner)")
    }
  }

  @Test(arguments: [
    (8000, 4000), (8000, 6000), (6048, 8064), (750, 1000), (1000, 600), (1000, 1000),
  ])
  func placesTheLayoutCropOnAWhiteCanvas(width: Int, height: Int) async throws {
    let layout = try FrameLayout(
      sourceWidth: width, sourceHeight: height, borderPx: defaultBorderPx)
    let crop = layout.sourceCrop ?? PixelRect(x: 0, y: 0, width: width, height: height)
    let bandX = crop.width * 6 / 100
    let bandY = crop.height * 6 / 100
    let directory = try TestDirectory()
    let source = try makeImage(width: width, height: height) { context in
      context.fill(CGRect(x: 0, y: 0, width: width, height: height), with: .red)
      context.fill(
        CGRect(x: crop.x, y: crop.y, width: crop.width, height: crop.height), with: .blue)
      context.fill(
        CGRect(
          x: crop.x + bandX, y: crop.y + bandY, width: crop.width - 2 * bandX,
          height: crop.height - 2 * bandY),
        with: .gray)
    }

    let output = try Pixels(jpeg: try await framed(try directory.write(source, as: .jpeg)).jpeg)

    #expect(output.width == layout.outputWidth)
    #expect(output.height == layout.outputHeight)
    let minX = layout.renderOffsetX
    let minY = layout.renderOffsetY
    let maxX = minX + layout.renderWidth - 1
    let maxY = minY + layout.renderHeight - 1
    let midX = (minX + maxX) / 2
    let midY = (minY + maxY) / 2
    let edges = [
      (outside: (minX - 1, midY), inside: (minX + 2, midY)),
      (outside: (maxX + 1, midY), inside: (maxX - 2, midY)),
      (outside: (midX, minY - 1), inside: (midX, minY + 2)),
      (outside: (midX, maxY + 1), inside: (midX, maxY - 2)),
    ]
    for edge in edges {
      #expect(output[edge.outside].isClose(to: .white, within: 4), "\(edge.outside)")
      #expect(output[edge.inside].isClose(to: .blue, within: 12), "\(edge.inside)")
    }
    #expect(output[midX, midY].isClose(to: .gray, within: 4))
    #expect(output[0, 0] == .white)
    #expect(output[output.width - 1, output.height - 1] == .white)
  }

  @Test(arguments: [UTType.jpeg, .heic])
  func framesTheFullImageNotItsEmbeddedThumbnail(type: UTType) async throws {
    let directory = try TestDirectory()
    let stripes = try makeImage(width: 4000, height: 3000) { context in
      context.fill(CGRect(x: 0, y: 0, width: 4000, height: 3000), with: .white)
      for x in stride(from: 0, to: 4000, by: 16) {
        context.fill(CGRect(x: x, y: 0, width: 8, height: 3000), with: RGB(0, 0, 0))
      }
    }
    let url = try directory.write(stripes, as: type, embedsThumbnail: true)
    let source = try #require(CGImageSourceCreateWithURL(url as CFURL, nil))
    let sizeRequest = [kCGImageSourceThumbnailMaxPixelSize: 2000] as CFDictionary
    let embedded = try #require(CGImageSourceCreateThumbnailAtIndex(source, 0, sizeRequest))
    #expect(embedded.width < 400, "the fixture must carry a small embedded thumbnail")

    let output = try Pixels(jpeg: try await framed(url).jpeg)

    let row = (0..<16).map { output[output.width / 2 + $0, output.height / 2].red }
    #expect((row.max() ?? 0) - (row.min() ?? 0) > 150, "\(row)")
  }

  @Test func compositesTransparencyOntoWhite() async throws {
    let directory = try TestDirectory()
    let source = try makeImage(width: 600, height: 400, alpha: true) { context in
      context.setFillColor(CGColor(srgbRed: 1, green: 0, blue: 0, alpha: 0.5))
      context.fill(CGRect(x: 300, y: 0, width: 300, height: 400))
    }

    let output = try Pixels(jpeg: try await framed(try directory.write(source, as: .png)).jpeg)

    #expect(output[output.width / 4, output.height / 2] == .white)
    #expect(
      output[output.width * 3 / 4, output.height / 2].isClose(to: RGB(255, 128, 128), within: 4))
  }

  @Test func convertsDisplayP3ToSRGB() async throws {
    let target = RGB(200, 100, 50)
    let displayP3 = try #require(CGColorSpace(name: CGColorSpace.displayP3))
    let storedValues = try #require(
      target.cgColor.converted(to: displayP3, intent: .relativeColorimetric, options: nil)?
        .components)
    #expect(abs(storedValues[0] * 255 - 200) > 5, "P3 values must differ from their sRGB values")
    let directory = try TestDirectory()
    let source = try makeImage(width: 600, height: 400, colorSpace: CGColorSpace.displayP3) {
      context in
      context.fill(CGRect(x: 0, y: 0, width: 600, height: 400), with: target)
    }

    let jpeg = try await framed(try directory.write(source, as: .png)).jpeg

    let encoded = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
    let image = try #require(CGImageSourceCreateImageAtIndex(encoded, 0, nil))
    #expect(image.colorSpace?.name == CGColorSpace.sRGB)
    let output = try Pixels(image)
    #expect(output[output.width / 2, output.height / 2].isClose(to: target, within: 2))
  }

  @Test func decodesA10BitHEIC() async throws {
    // Encoded on macOS: the iOS simulator's HEIC encoder writes linear values for ISO HDR.
    let url = try #require(Bundle.module.url(forResource: "hdr-10bit", withExtension: "heic"))
    let source = try #require(CGImageSourceCreateWithURL(url as CFURL, nil))
    let depth = try properties(source)["Depth"] as? Int
    #expect(depth == 10)

    let output = try Pixels(jpeg: try await framed(url).jpeg)

    #expect(output[output.width / 4, output.height / 2].isClose(to: .gray, within: 3))
  }

  @Test func keepsNoSourceMetadata() async throws {
    let metadata = CGImageMetadataCreateMutable()
    let canaries: [(dictionary: CFString, key: CFString, value: CFTypeRef)] = [
      (kCGImagePropertyGPSDictionary, kCGImagePropertyGPSLatitude, -41.2865 as CFNumber),
      (kCGImagePropertyGPSDictionary, kCGImagePropertyGPSLongitude, 174.7762 as CFNumber),
      (kCGImagePropertyTIFFDictionary, kCGImagePropertyTIFFMake, "CanaryMake" as CFString),
      (kCGImagePropertyTIFFDictionary, kCGImagePropertyTIFFModel, "CanaryModel" as CFString),
      (
        kCGImagePropertyExifDictionary, kCGImagePropertyExifDateTimeOriginal,
        "2026:11:06 12:00:00" as CFString
      ),
    ]
    for canary in canaries {
      #expect(
        CGImageMetadataSetValueMatchingImageProperty(
          metadata, canary.dictionary, canary.key, canary.value))
    }
    #expect(
      CGImageMetadataSetValueWithPath(
        metadata, nil, "xmp:CreatorTool" as CFString, "CanaryTool" as CFString))
    let directory = try TestDirectory()
    let image = try makeImage(width: 600, height: 400) { context in
      context.fill(CGRect(x: 0, y: 0, width: 600, height: 400), with: .gray)
    }
    let url = try directory.write(image, as: .jpeg, metadata: metadata)
    let source = try #require(CGImageSourceCreateWithURL(url as CFURL, nil))
    let sourceProperties = try properties(source)
    let sourceExif = sourceProperties["{Exif}"] as? [String: Any] ?? [:]
    #expect(sourceProperties["{GPS}"] != nil)
    #expect((sourceProperties["{TIFF}"] as? [String: Any])?["Model"] as? String == "CanaryModel")
    #expect(sourceExif["DateTimeOriginal"] != nil)
    #expect(try metadataTags(source).contains("xmp:CreatorTool"))
    #expect(try Data(contentsOf: url).range(of: Data("Canary".utf8)) != nil)

    let jpeg = try await framed(url).jpeg

    let output = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
    let properties = try properties(output)
    #expect(
      Set(properties.keys).isSubset(of: [
        "ColorModel", "Depth", "PixelWidth", "PixelHeight", "ProfileName", "{Exif}", "{JFIF}",
      ]))
    let exif = properties["{Exif}"] as? [String: Any] ?? [:]
    #expect(Set(exif.keys).isSubset(of: ["ColorSpace", "PixelXDimension", "PixelYDimension"]))
    #expect(
      try metadataTags(output).isSubset(of: [
        "exif:ColorSpace", "exif:PixelXDimension", "exif:PixelYDimension",
      ]))
    #expect(jpeg.range(of: Data("Canary".utf8)) == nil)
  }

  @Test func encodesABaselineJPEG() async throws {
    let directory = try TestDirectory()
    let jpeg = try await framed(try directory.solidImage(width: 600, height: 400)).jpeg
    #expect(firstFrameMarker(jpeg) == 0xC0)
  }

  @Test func previewIsASmallCopyOfTheOutput() async throws {
    let directory = try TestDirectory()
    let photo = try await framed(try directory.solidImage(width: 4000, height: 3000))
    #expect(max(photo.preview.width, photo.preview.height) == 360)
    #expect(try Pixels(photo.preview)[0, 0] == .white)
  }

  @Test(arguments: [
    (8064, 6048, 4032), (6048, 8064, 3536), (6000, 4000, 4094), (3000, 2000, 3000),
    (1200, 900, 1200),
  ])
  func decodesAtAJPEGStepWhenItKeepsEnoughDetail(width: Int, height: Int, longEdge: Int) throws {
    let layout = try FrameLayout(
      sourceWidth: width, sourceHeight: height, borderPx: defaultBorderPx)
    #expect(decodeLongEdge(sourceWidth: width, sourceHeight: height, layout: layout) == longEdge)
  }

  @Test func rejectsAFileImageIOCannotRead() async throws {
    let directory = try TestDirectory()
    let url = try directory.write(Data("not an image".utf8), named: "garbage.jpg")
    await #expect(throws: PhotoFailure.unreadable) { try await framed(url) }
  }

  @Test(arguments: [(3, 2), (1, 5)])
  func rejectsASourceTooSmallForTheBorder(width: Int, height: Int) async throws {
    let directory = try TestDirectory()
    let url = try directory.solidImage(width: width, height: height, as: .png)
    await #expect(throws: PhotoFailure.tooSmall) { try await framed(url) }
  }

  private func point(in layout: FrameLayout, near corner: Corner) -> (Int, Int) {
    let insetX = layout.renderWidth / 10
    let insetY = layout.renderHeight / 10
    let left = layout.renderOffsetX + insetX
    let right = layout.renderOffsetX + layout.renderWidth - 1 - insetX
    let top = layout.renderOffsetY + insetY
    let bottom = layout.renderOffsetY + layout.renderHeight - 1 - insetY
    switch corner {
    case .topLeft: return (left, top)
    case .topRight: return (right, top)
    case .bottomRight: return (right, bottom)
    case .bottomLeft: return (left, bottom)
    }
  }

  private func properties(_ source: CGImageSource) throws -> [String: Any] {
    try #require(CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any])
  }

  private func metadataTags(_ source: CGImageSource) throws -> Set<String> {
    guard let metadata = CGImageSourceCopyMetadataAtIndex(source, 0, nil) else { return [] }
    let tags = try #require(CGImageMetadataCopyTags(metadata) as? [CGImageMetadataTag])
    return Set(
      tags.compactMap { tag in
        guard let prefix = CGImageMetadataTagCopyPrefix(tag),
          let name = CGImageMetadataTagCopyName(tag)
        else { return nil }
        return "\(prefix):\(name)"
      })
  }

  /// The first SOFn marker: 0xC0 is baseline, 0xC2 progressive.
  private func firstFrameMarker(_ jpeg: Data) -> UInt8? {
    let bytes = [UInt8](jpeg)
    var index = 2
    while index + 3 < bytes.count, bytes[index] == 0xFF {
      let marker = bytes[index + 1]
      if (0xC0...0xCF).contains(marker), ![0xC4, 0xC8, 0xCC].contains(marker) { return marker }
      index += 2 + (Int(bytes[index + 2]) << 8 | Int(bytes[index + 3]))
    }
    return nil
  }
}

extension Pixels {
  subscript(_ point: (Int, Int)) -> RGB { self[point.0, point.1] }
}
