import CoreGraphics
import Foundation
import ImageIO

struct FramedPhoto: Sendable {
  let jpeg: Data
  let preview: CGImage
}

@concurrent
func framePhoto(_ source: SourceFile, borderPx: Int) async throws(PhotoFailure) -> FramedPhoto {
  let result = autoreleasepool {
    Result { () throws(PhotoFailure) in try frame(source.url, borderPx: borderPx) }
  }
  return try result.get()
}

private func frame(_ url: URL, borderPx: Int) throws(PhotoFailure) -> FramedPhoto {
  let image = try openImage(url)
  let layout = try frameLayout(image, borderPx: borderPx)
  let renderRect = PixelRect(
    x: layout.renderOffsetX, y: layout.renderOffsetY, width: layout.renderWidth,
    height: layout.renderHeight)
  let render = try renderRegion(of: image, crop: layout.sourceCrop, size: renderRect.size)
  let canvas = try WhiteCanvas(
    size: PixelSize(width: layout.outputWidth, height: layout.outputHeight))
  canvas.draw(render, in: renderRect)
  let jpeg = try canvas.jpeg()
  return FramedPhoto(jpeg: jpeg, preview: try makePreview(jpeg))
}

private func frameLayout(_ image: OpenedImage, borderPx: Int) throws(PhotoFailure) -> FrameLayout {
  let layout: FrameLayout
  do throws(FrameLayoutError) {
    layout = try FrameLayout(
      sourceWidth: image.orientedSize.width, sourceHeight: image.orientedSize.height,
      borderPx: borderPx)
  } catch {
    switch error {
    case .sourceTooSmall: throw .tooSmall
    case .invalidInput: throw .unreadable
    }
  }
  guard layout.renderWidth > 0, layout.renderHeight > 0 else { throw .tooSmall }
  return layout
}

private func makePreview(_ jpeg: Data) throws(PhotoFailure) -> CGImage {
  let options: [CFString: Any] = [
    kCGImageSourceCreateThumbnailFromImageAlways: true,
    kCGImageSourceThumbnailMaxPixelSize: 360,
    kCGImageSourceShouldCacheImmediately: true,
  ]
  guard
    let source = CGImageSourceCreateWithData(jpeg as CFData, nil),
    let preview = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
  else { throw .renderFailed }
  return preview
}
