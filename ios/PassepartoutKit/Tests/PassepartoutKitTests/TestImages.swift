import CoreGraphics
import Foundation
import ImageIO
import Testing
import UniformTypeIdentifiers

@testable import PassepartoutKit

struct RGB: Equatable, CustomStringConvertible {
  static let white = RGB(255, 255, 255)
  static let red = RGB(220, 30, 30)
  static let blue = RGB(30, 60, 200)
  static let gray = RGB(128, 128, 128)

  let red: Int
  let green: Int
  let blue: Int

  init(_ red: Int, _ green: Int, _ blue: Int) {
    self.red = red
    self.green = green
    self.blue = blue
  }

  var description: String { "(\(red), \(green), \(blue))" }

  var cgColor: CGColor {
    CGColor(
      srgbRed: CGFloat(red) / 255, green: CGFloat(green) / 255, blue: CGFloat(blue) / 255, alpha: 1)
  }

  func isClose(to other: RGB, within tolerance: Int) -> Bool {
    abs(red - other.red) <= tolerance && abs(green - other.green) <= tolerance
      && abs(blue - other.blue) <= tolerance
  }
}

/// Draws a synthetic image. The closure draws with a top-left origin, like the layout.
func makeImage(
  width: Int, height: Int, colorSpace name: CFString = CGColorSpace.sRGB, alpha: Bool = false,
  draw: (CGContext) -> Void
) throws -> CGImage {
  let colorSpace = try #require(CGColorSpace(name: name))
  let alphaInfo: CGImageAlphaInfo = alpha ? .premultipliedLast : .noneSkipLast
  let context = try #require(
    CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
      space: colorSpace, bitmapInfo: alphaInfo.rawValue))
  context.translateBy(x: 0, y: CGFloat(height))
  context.scaleBy(x: 1, y: -1)
  draw(context)
  return try #require(context.makeImage())
}

extension CGContext {
  func fill(_ rect: CGRect, with color: RGB) {
    setFillColor(color.cgColor)
    fill(rect)
  }
}

/// A temporary directory for one test's source files, deleted with the object.
final class TestDirectory {
  let url: URL

  init() throws {
    url = FileManager.default.temporaryDirectory.appending(
      path: "PassepartoutKitTests-\(UUID().uuidString)", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  }

  deinit {
    try? FileManager.default.removeItem(at: url)
  }

  func write(
    _ image: CGImage, as type: UTType, named name: String = UUID().uuidString,
    orientation: Int = 1, metadata: CGImageMetadata? = nil
  ) throws -> URL {
    let file = url.appending(path: name).appendingPathExtension(
      type.preferredFilenameExtension ?? "img")
    let destination = try #require(
      CGImageDestinationCreateWithURL(file as CFURL, type.identifier as CFString, 1, nil),
      "this platform cannot encode \(type.identifier)")
    let options =
      [
        kCGImagePropertyOrientation: orientation,
        kCGImageDestinationLossyCompressionQuality: 1.0,
      ] as CFDictionary
    if let metadata {
      CGImageDestinationAddImageAndMetadata(destination, image, metadata, options)
    } else {
      CGImageDestinationAddImage(destination, image, options)
    }
    try #require(CGImageDestinationFinalize(destination))
    return file
  }

  func write(_ bytes: Data, named name: String) throws -> URL {
    let file = url.appending(path: name)
    try bytes.write(to: file)
    return file
  }

  func solidImage(width: Int, height: Int, color: RGB = .gray, as type: UTType = .jpeg) throws
    -> URL
  {
    let image = try makeImage(width: width, height: height) { context in
      context.fill(CGRect(x: 0, y: 0, width: width, height: height), with: color)
    }
    return try write(image, as: type)
  }
}

/// Decoded sRGB pixels of an image, addressed from the top-left.
struct Pixels {
  let width: Int
  let height: Int
  private let bytes: [UInt8]

  init(jpeg: Data) throws {
    let source = try #require(CGImageSourceCreateWithData(jpeg as CFData, nil))
    try self.init(try #require(CGImageSourceCreateImageAtIndex(source, 0, nil)))
  }

  init(_ image: CGImage) throws {
    let width = image.width
    let height = image.height
    let colorSpace = try #require(CGColorSpace(name: CGColorSpace.sRGB))
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    let drawn = bytes.withUnsafeMutableBytes { buffer in
      guard
        let context = CGContext(
          data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8,
          bytesPerRow: width * 4, space: colorSpace,
          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
      else { return false }
      context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
      return true
    }
    try #require(drawn)
    self.width = width
    self.height = height
    self.bytes = bytes
  }

  subscript(x: Int, y: Int) -> RGB {
    let offset = (y * width + x) * 4
    return RGB(Int(bytes[offset]), Int(bytes[offset + 1]), Int(bytes[offset + 2]))
  }
}

func framed(_ url: URL) async throws -> FramedPhoto {
  try await framePhoto(SourceFile(copying: url), borderPx: defaultBorderPx)
}
