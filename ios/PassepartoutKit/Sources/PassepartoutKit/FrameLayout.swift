let defaultBorderPx = 57

struct PixelRect: Equatable, Sendable, Decodable {
  let x: Int
  let y: Int
  let width: Int
  let height: Int
}

enum FrameLayoutError: String, Error, Equatable, Sendable, Decodable {
  case invalidInput
  case sourceTooSmall
}

struct FrameLayout: Equatable, Sendable, Decodable {
  enum Variant: String, Sendable, Decodable {
    case landscape
    case portrait
  }

  let variant: Variant
  let outputWidth: Int
  let outputHeight: Int
  let effectiveBorderPx: Int
  let innerWidth: Int
  let innerHeight: Int
  let renderWidth: Int
  let renderHeight: Int
  let renderOffsetX: Int
  let renderOffsetY: Int
  let sourceCrop: PixelRect?
}

extension FrameLayout {
  init(sourceWidth: Int, sourceHeight: Int, borderPx: Int) throws(FrameLayoutError) {
    guard sourceWidth > 0, sourceHeight > 0, borderPx >= 0 else { throw .invalidInput }
    let source = SourceSize(width: sourceWidth, height: sourceHeight)
    let target = sourceWidth > sourceHeight ? Target.landscape : Target.portrait

    for outputWidth in stride(
      from: target.maxWidth, through: target.ratioWidth, by: -target.ratioWidth)
    {
      let outputHeight = outputWidth / target.ratioWidth * target.ratioHeight
      if outputHeight > target.maxHeight { continue }

      let effectiveBorderPx = scaleBorder(
        borderPx, Double(outputWidth) / Double(target.maxWidth))
      let dimensions = Dimensions(
        outputWidth: outputWidth,
        outputHeight: outputHeight,
        effectiveBorderPx: effectiveBorderPx,
        innerWidth: outputWidth - 2 * effectiveBorderPx,
        innerHeight: outputHeight - 2 * effectiveBorderPx
      )
      if dimensions.innerWidth <= 0 || dimensions.innerHeight <= 0 { continue }

      switch target.variant {
      case .landscape:
        if dimensions.innerWidth > sourceWidth || dimensions.innerHeight > sourceHeight {
          continue
        }
        self = createLandscapeLayout(source, dimensions)
        return
      case .portrait:
        let fit = min(
          Double(dimensions.innerWidth) / Double(sourceWidth),
          Double(dimensions.innerHeight) / Double(sourceHeight))
        if fit > 1 { continue }
        self = createPortraitLayout(source, dimensions)
        return
      }
    }

    throw .sourceTooSmall
  }
}

private struct SourceSize {
  let width: Int
  let height: Int
}

private struct Dimensions {
  let outputWidth: Int
  let outputHeight: Int
  let effectiveBorderPx: Int
  let innerWidth: Int
  let innerHeight: Int
}

private struct Target {
  static let landscape = Target(
    variant: .landscape, maxWidth: 2160, maxHeight: 1440, ratioWidth: 3, ratioHeight: 2)
  static let portrait = Target(
    variant: .portrait, maxWidth: 1440, maxHeight: 1920, ratioWidth: 3, ratioHeight: 4)

  let variant: FrameLayout.Variant
  let maxWidth: Int
  let maxHeight: Int
  let ratioWidth: Int
  let ratioHeight: Int
}

private func createLandscapeLayout(_ source: SourceSize, _ dimensions: Dimensions) -> FrameLayout {
  FrameLayout(
    variant: .landscape,
    outputWidth: dimensions.outputWidth,
    outputHeight: dimensions.outputHeight,
    effectiveBorderPx: dimensions.effectiveBorderPx,
    innerWidth: dimensions.innerWidth,
    innerHeight: dimensions.innerHeight,
    renderWidth: dimensions.innerWidth,
    renderHeight: dimensions.innerHeight,
    renderOffsetX: dimensions.effectiveBorderPx,
    renderOffsetY: dimensions.effectiveBorderPx,
    sourceCrop: computeCenteredCoverCrop(
      source, frameWidth: dimensions.innerWidth, frameHeight: dimensions.innerHeight)
  )
}

private func createPortraitLayout(_ source: SourceSize, _ dimensions: Dimensions) -> FrameLayout {
  let renderScale = min(
    1,
    Double(dimensions.innerWidth) / Double(source.width),
    Double(dimensions.innerHeight) / Double(source.height))
  let renderWidth = min(dimensions.innerWidth, Int((Double(source.width) * renderScale).rounded()))
  let renderHeight = min(
    dimensions.innerHeight, Int((Double(source.height) * renderScale).rounded()))

  return FrameLayout(
    variant: .portrait,
    outputWidth: dimensions.outputWidth,
    outputHeight: dimensions.outputHeight,
    effectiveBorderPx: dimensions.effectiveBorderPx,
    innerWidth: dimensions.innerWidth,
    innerHeight: dimensions.innerHeight,
    renderWidth: renderWidth,
    renderHeight: renderHeight,
    renderOffsetX: Int((Double(dimensions.outputWidth - renderWidth) / 2).rounded()),
    renderOffsetY: Int((Double(dimensions.outputHeight - renderHeight) / 2).rounded()),
    sourceCrop: nil
  )
}

private func computeCenteredCoverCrop(_ source: SourceSize, frameWidth: Int, frameHeight: Int)
  -> PixelRect
{
  let sourceRatio = Double(source.width) / Double(source.height)
  let frameRatio = Double(frameWidth) / Double(frameHeight)

  if sourceRatio > frameRatio {
    let width = Int((Double(source.height) * frameRatio).rounded())
    return PixelRect(
      x: Int((Double(source.width - width) / 2).rounded()), y: 0, width: width,
      height: source.height)
  }

  let height = Int((Double(source.width) / frameRatio).rounded())
  return PixelRect(
    x: 0, y: Int((Double(source.height - height) / 2).rounded()), width: source.width,
    height: height)
}

private func scaleBorder(_ borderPx: Int, _ scale: Double) -> Int {
  if borderPx == 0 { return 0 }
  return max(1, Int((Double(borderPx) * scale).rounded()))
}
