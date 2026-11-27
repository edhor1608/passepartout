import CoreGraphics
import Foundation

/// The editor keeps one preview per photo in memory, so previews stay small.
let collagePreviewLongEdge = 1000

/// Reads the oriented size and a preview of one original, one decode at a time.
@concurrent
func readOriginal(_ file: SourceFile) async throws(PhotoFailure) -> LoadedOriginal {
  let result = autoreleasepool {
    Result { () throws(PhotoFailure) in
      let image = try openImage(file.url)
      return LoadedOriginal(
        file: file, pixelSize: image.orientedSize,
        preview: try decode(image, longEdge: collagePreviewLongEdge))
    }
  }
  return try result.get()
}

/// The collage as it goes into the library: the layout's canvas through the same pixel path as
/// `framePhoto`. Each cell shows the centred part of its photo that fills it, and each original is
/// read again and decoded at the size its cell needs, one at a time.
@concurrent
func renderCollage(_ document: CollageDocument) async throws(PhotoFailure) -> Data {
  let layout = document.layout
  let canvas = try WhiteCanvas(size: layout.canvas)
  for cell in layout.cells {
    let drawn = autoreleasepool {
      Result { () throws(PhotoFailure) in
        let image = try openImage(cell.photo.original.file.url)
        let crop = centeredCoverCrop(of: image.orientedSize, filling: cell.rect.size)
        canvas.draw(try renderRegion(of: image, crop: crop, size: cell.rect.size), in: cell.rect)
      }
    }
    try drawn.get()
  }
  return try canvas.jpeg()
}
