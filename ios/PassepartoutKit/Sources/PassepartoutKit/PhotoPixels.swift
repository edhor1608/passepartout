import Accelerate
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

private let sRGB = CGColorSpace(name: CGColorSpace.sRGB)

struct OpenedImage {
  let source: CGImageSource
  let index: Int
  let orientedSize: PixelSize
}

func openImage(_ url: URL) throws(PhotoFailure) -> OpenedImage {
  guard
    let source = CGImageSourceCreateWithURL(
      url as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary)
  else { throw .unreadable }
  let index = CGImageSourceGetPrimaryImageIndex(source)
  guard
    let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
    let width = properties[kCGImagePropertyPixelWidth] as? Int,
    let height = properties[kCGImagePropertyPixelHeight] as? Int,
    width > 0, height > 0
  else { throw .unreadable }

  let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
  let swapsAxes = (5...8).contains(orientation)
  return OpenedImage(
    source: source,
    index: index,
    orientedSize: swapsAxes
      ? PixelSize(width: height, height: width) : PixelSize(width: width, height: height)
  )
}

/// `crop` of the oriented image, all of it when `nil`, in sRGB and resampled to exactly `size`.
func renderRegion(of image: OpenedImage, crop: PixelRect?, size: PixelSize) throws(PhotoFailure)
  -> CGImage
{
  guard let sRGB else { throw .renderFailed }
  let longEdge = decodeLongEdge(source: image.orientedSize, crop: crop, size: size)
  let decoded = try decode(image, longEdge: longEdge)
  return try resample(
    decoded,
    crop: cropInDecodedPixels(crop, image: image, decoded: decoded),
    size: size,
    colorSpace: sRGB
  )
}

/// ImageIO decodes a JPEG at a DCT step, its long edge halved up to three times, without a
/// full decode.
func decodeLongEdge(source: PixelSize, crop: PixelRect?, size: PixelSize) -> Int {
  let cropWidth = crop?.width ?? source.width
  let cropHeight = crop?.height ?? source.height
  let scale = max(
    Double(size.width) / Double(cropWidth),
    Double(size.height) / Double(cropHeight))
  let longEdge = max(source.width, source.height)
  let needed = Double(longEdge) * scale
  let twice = min(longEdge, 2 * Int(needed.rounded(.up)))
  let steps = (1...3).map { halvings in (longEdge + (1 << halvings) - 1) >> halvings }
  guard let step = steps.first(where: { $0 <= twice }), Double(step) >= 1.5 * needed else {
    return twice
  }
  return step
}

/// The oriented image with a long edge of at most `longEdge`, tone mapped to SDR.
func decode(_ image: OpenedImage, longEdge: Int) throws(PhotoFailure) -> CGImage {
  let options: [CFString: Any] = [
    // Without this, JPEG, HEIC and RAW files hand back their small embedded thumbnail.
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceCreateThumbnailWithTransform: true,
    kCGImageSourceThumbnailMaxPixelSize: longEdge,
    kCGImageSourceShouldCacheImmediately: true,
    kCGImageSourceDecodeRequest: kCGImageSourceDecodeToSDR,
  ]
  guard
    let decoded = CGImageSourceCreateThumbnailAtIndex(
      image.source, image.index, options as CFDictionary)
  else { throw .renderFailed }
  return decoded
}

private func cropInDecodedPixels(_ crop: PixelRect?, image: OpenedImage, decoded: CGImage)
  -> PixelRect
{
  guard let crop else { return PixelRect(x: 0, y: 0, width: decoded.width, height: decoded.height) }
  let scaleX = Double(decoded.width) / Double(image.orientedSize.width)
  let scaleY = Double(decoded.height) / Double(image.orientedSize.height)
  func edge(_ value: Int, _ scale: Double, lowest: Int, highest: Int) -> Int {
    min(max(Int((Double(value) * scale).rounded()), lowest), highest)
  }
  let minX = edge(crop.x, scaleX, lowest: 0, highest: decoded.width - 1)
  let minY = edge(crop.y, scaleY, lowest: 0, highest: decoded.height - 1)
  let maxX = edge(crop.x + crop.width, scaleX, lowest: minX + 1, highest: decoded.width)
  let maxY = edge(crop.y + crop.height, scaleY, lowest: minY + 1, highest: decoded.height)
  return PixelRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
}

/// Core Graphics reads every pixel format ImageIO returns; `vImage_Buffer(cgImage:format:)`
/// rejects the packed 10-bit format of HDR HEIC.
private func resample(
  _ decoded: CGImage, crop: PixelRect, size: PixelSize, colorSpace: CGColorSpace
) throws(PhotoFailure) -> CGImage {
  let alpha = CGImageAlphaInfo.premultipliedLast.rawValue
  guard
    let converted = CGContext(
      data: nil,
      width: crop.width,
      height: crop.height,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: alpha),
    let format = vImage_CGImageFormat(
      bitsPerComponent: 8,
      bitsPerPixel: 32,
      colorSpace: colorSpace,
      bitmapInfo: CGBitmapInfo(rawValue: alpha))
  else { throw .renderFailed }
  converted.draw(
    decoded,
    in: CGRect(
      x: -crop.x, y: crop.y + crop.height - decoded.height, width: decoded.width,
      height: decoded.height))
  guard let pixels = converted.data else { throw .renderFailed }

  var cropped = vImage_Buffer(
    data: pixels,
    height: vImagePixelCount(crop.height),
    width: vImagePixelCount(crop.width),
    rowBytes: converted.bytesPerRow)
  do {
    var scaled = try vImage_Buffer(width: size.width, height: size.height, bitsPerPixel: 32)
    defer { scaled.free() }
    let status = withExtendedLifetime(converted) {
      vImageScale_ARGB8888(&cropped, &scaled, nil, vImage_Flags(kvImageHighQualityResampling))
    }
    guard status == kvImageNoError else { throw PhotoFailure.renderFailed }
    return try scaled.createCGImage(format: format)
  } catch {
    throw .renderFailed
  }
}

/// An opaque white sRGB bitmap that photos are drawn onto, with the origin at the top left.
struct WhiteCanvas {
  let size: PixelSize
  private let context: CGContext

  init(size: PixelSize) throws(PhotoFailure) {
    guard
      let sRGB,
      let context = CGContext(
        data: nil,
        width: size.width,
        height: size.height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: sRGB,
        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
    else { throw .renderFailed }
    context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: size.width, height: size.height))
    self.size = size
    self.context = context
  }

  func draw(_ image: CGImage, in rect: PixelRect) {
    let flippedY = size.height - rect.y - rect.height
    context.draw(image, in: CGRect(x: rect.x, y: flippedY, width: rect.width, height: rect.height))
  }

  /// Baseline JPEG at quality 1.0 with no metadata.
  func jpeg() throws(PhotoFailure) -> Data {
    guard let canvas = context.makeImage() else { throw .renderFailed }
    let data = NSMutableData()
    guard
      let destination = CGImageDestinationCreateWithData(
        data, UTType.jpeg.identifier as CFString, 1, nil)
    else { throw .renderFailed }
    CGImageDestinationAddImage(
      destination, canvas, [kCGImageDestinationLossyCompressionQuality: 1.0] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw .renderFailed }
    return data as Data
  }
}
