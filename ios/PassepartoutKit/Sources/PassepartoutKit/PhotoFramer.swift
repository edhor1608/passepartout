import Accelerate
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A finished passepartout image, ready to add to the Photos library.
struct FramedPhoto: Sendable {
  /// Baseline sRGB JPEG at quality 1.0. Its only metadata is JFIF and ImageIO's own Exif
  /// ColorSpace and pixel dimensions, none of it from the source.
  let jpeg: Data
  let preview: CGImage
}

/// Decode, orient, tone-map to SDR, convert to sRGB, crop and Lanczos-resample to the layout,
/// composite onto white, encode. Peak memory is about two decodes at twice the render scale
/// (~100 MB for a 48 MP source), so the session runs one photo at a time.
@concurrent
func framePhoto(_ source: SourceFile, borderPx: Int) async throws(PhotoFailure) -> FramedPhoto {
  // ImageIO and vImage autorelease their buffers; draining per photo keeps a batch at one peak.
  let result = autoreleasepool {
    Result { () throws(PhotoFailure) in try frame(source.url, borderPx: borderPx) }
  }
  return try result.get()
}

private let sRGB = CGColorSpace(name: CGColorSpace.sRGB)

private func frame(_ url: URL, borderPx: Int) throws(PhotoFailure) -> FramedPhoto {
  guard let sRGB else { throw .renderFailed }
  let image = try openImage(url)
  let layout = try frameLayout(image, borderPx: borderPx)
  let decoded = try decodeOriented(image, longEdge: decodeLongEdge(image, layout: layout))
  let render = try resample(
    decoded,
    crop: cropInDecodedPixels(layout.sourceCrop, image: image, decoded: decoded),
    width: layout.renderWidth,
    height: layout.renderHeight,
    colorSpace: sRGB
  )
  let jpeg = try encodeJPEG(composeOnWhite(render, layout: layout, colorSpace: sRGB))
  return FramedPhoto(jpeg: jpeg, preview: try makePreview(jpeg))
}

/// The primary image of a file, with its size after EXIF orientation. No pixels decoded yet.
private struct OpenedImage {
  let source: CGImageSource
  let index: Int
  let orientedWidth: Int
  let orientedHeight: Int
}

private func openImage(_ url: URL) throws(PhotoFailure) -> OpenedImage {
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
    orientedWidth: swapsAxes ? height : width,
    orientedHeight: swapsAxes ? width : height
  )
}

private func frameLayout(_ image: OpenedImage, borderPx: Int) throws(PhotoFailure) -> FrameLayout {
  let layout: FrameLayout
  do throws(FrameLayoutError) {
    layout = try FrameLayout(
      sourceWidth: image.orientedWidth, sourceHeight: image.orientedHeight, borderPx: borderPx)
  } catch {
    switch error {
    case .sourceTooSmall: throw .tooSmall
    case .invalidInput: throw .unreadable
    }
  }
  // The TS layout rounds the render rect of extreme ratios such as 1x5 down to zero pixels,
  // and vImage traps on an empty buffer.
  guard layout.renderWidth > 0, layout.renderHeight > 0 else { throw .tooSmall }
  return layout
}

/// Twice the long edge the render needs, capped at the source. The 2x headroom leaves the
/// anti-aliasing to Lanczos: on a zone plate it measured within noise of a full decode
/// (passband 89.9 vs 90.3) while decoding a quarter of the pixels.
private func decodeLongEdge(_ image: OpenedImage, layout: FrameLayout) -> Int {
  let cropWidth = layout.sourceCrop?.width ?? image.orientedWidth
  let cropHeight = layout.sourceCrop?.height ?? image.orientedHeight
  let scale = max(
    Double(layout.renderWidth) / Double(cropWidth),
    Double(layout.renderHeight) / Double(cropHeight))
  let longEdge = max(image.orientedWidth, image.orientedHeight)
  return min(longEdge, 2 * Int((Double(longEdge) * scale).rounded(.up)))
}

private func decodeOriented(_ image: OpenedImage, longEdge: Int) throws(PhotoFailure) -> CGImage {
  let options: [CFString: Any] = [
    // Without this, RAW and HEIC files hand back their small embedded preview.
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

/// Maps the layout crop from oriented-source pixels to decoded pixels. Edges round
/// independently, so the error stays below one decoded pixel (0.25 output px at 2x).
private func cropInDecodedPixels(_ crop: PixelRect?, image: OpenedImage, decoded: CGImage)
  -> PixelRect
{
  guard let crop else { return PixelRect(x: 0, y: 0, width: decoded.width, height: decoded.height) }
  let scaleX = Double(decoded.width) / Double(image.orientedWidth)
  let scaleY = Double(decoded.height) / Double(image.orientedHeight)
  func edge(_ value: Int, _ scale: Double, lowest: Int, highest: Int) -> Int {
    min(max(Int((Double(value) * scale).rounded()), lowest), highest)
  }
  let minX = edge(crop.x, scaleX, lowest: 0, highest: decoded.width - 1)
  let minY = edge(crop.y, scaleY, lowest: 0, highest: decoded.height - 1)
  let maxX = edge(crop.x + crop.width, scaleX, lowest: minX + 1, highest: decoded.width)
  let maxY = edge(crop.y + crop.height, scaleY, lowest: minY + 1, highest: decoded.height)
  return PixelRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
}

/// Draws the decoded image into 8-bit premultiplied sRGB, the one colour conversion, then
/// Lanczos-scales the crop to exactly the render size. Core Graphics reads every pixel format
/// ImageIO returns; `vImage_Buffer(cgImage:format:)` rejects the packed 10-bit format of HDR HEIC.
private func resample(
  _ decoded: CGImage, crop: PixelRect, width: Int, height: Int, colorSpace: CGColorSpace
) throws(PhotoFailure) -> CGImage {
  let alpha = CGImageAlphaInfo.premultipliedLast.rawValue
  guard
    let converted = CGContext(
      data: nil,
      width: decoded.width,
      height: decoded.height,
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
  converted.draw(decoded, in: CGRect(x: 0, y: 0, width: decoded.width, height: decoded.height))
  guard let pixels = converted.data else { throw .renderFailed }

  var cropped = vImage_Buffer(
    data: pixels.advanced(by: crop.y * converted.bytesPerRow + crop.x * 4),
    height: vImagePixelCount(crop.height),
    width: vImagePixelCount(crop.width),
    rowBytes: converted.bytesPerRow)
  do {
    var scaled = try vImage_Buffer(width: width, height: height, bitsPerPixel: 32)
    defer { scaled.free() }
    let status = vImageScale_ARGB8888(
      &cropped, &scaled, nil, vImage_Flags(kvImageHighQualityResampling))
    guard status == kvImageNoError else { throw PhotoFailure.renderFailed }
    return try scaled.createCGImage(format: format)
  } catch {
    throw .renderFailed
  }
}

private func composeOnWhite(_ render: CGImage, layout: FrameLayout, colorSpace: CGColorSpace)
  throws(PhotoFailure) -> CGImage
{
  guard
    let context = CGContext(
      data: nil,
      width: layout.outputWidth,
      height: layout.outputHeight,
      bitsPerComponent: 8,
      bytesPerRow: 0,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
  else { throw .renderFailed }

  context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1))
  context.fill(CGRect(x: 0, y: 0, width: layout.outputWidth, height: layout.outputHeight))
  // The layout counts y from the top; Core Graphics counts it from the bottom.
  let flippedY = layout.outputHeight - layout.renderOffsetY - layout.renderHeight
  context.draw(
    render,
    in: CGRect(
      x: layout.renderOffsetX, y: flippedY, width: layout.renderWidth, height: layout.renderHeight)
  )

  guard let canvas = context.makeImage() else { throw .renderFailed }
  return canvas
}

private func encodeJPEG(_ canvas: CGImage) throws(PhotoFailure) -> Data {
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

private func makePreview(_ jpeg: Data) throws(PhotoFailure) -> CGImage {
  let options: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceThumbnailMaxPixelSize: 480,
    kCGImageSourceShouldCacheImmediately: true,
  ]
  guard
    let source = CGImageSourceCreateWithData(jpeg as CFData, nil),
    let preview = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  else { throw .renderFailed }
  return preview
}
