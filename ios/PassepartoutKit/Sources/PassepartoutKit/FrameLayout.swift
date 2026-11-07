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
  let renderWidth = min(dimensions.innerWidth, jsRound(Double(source.width) * renderScale))
  let renderHeight = min(dimensions.innerHeight, jsRound(Double(source.height) * renderScale))

  return FrameLayout(
    variant: .portrait,
    outputWidth: dimensions.outputWidth,
    outputHeight: dimensions.outputHeight,
    effectiveBorderPx: dimensions.effectiveBorderPx,
    innerWidth: dimensions.innerWidth,
    innerHeight: dimensions.innerHeight,
    renderWidth: renderWidth,
    renderHeight: renderHeight,
    renderOffsetX: jsRound(Double(dimensions.outputWidth - renderWidth) / 2),
    renderOffsetY: jsRound(Double(dimensions.outputHeight - renderHeight) / 2),
    sourceCrop: nil
  )
}

private func computeCenteredCoverCrop(_ source: SourceSize, frameWidth: Int, frameHeight: Int)
  -> PixelRect
{
  let sourceRatio = Double(source.width) / Double(source.height)
  let frameRatio = Double(frameWidth) / Double(frameHeight)

  if sourceRatio > frameRatio {
    let width = jsRound(Double(source.height) * frameRatio)
    return PixelRect(
      x: jsRound(Double(source.width - width) / 2), y: 0, width: width, height: source.height)
  }

  let height = jsRound(Double(source.width) / frameRatio)
  return PixelRect(
    x: 0, y: jsRound(Double(source.height - height) / 2), width: source.width, height: height)
}

private func scaleBorder(_ borderPx: Int, _ scale: Double) -> Int {
  if borderPx == 0 { return 0 }
  return max(1, jsRound(Double(borderPx) * scale))
}

/// JavaScript `Math.round`: ties go toward +infinity. Swift's `.rounded()` ties away from zero,
/// which differs for negative halves. `value - floor` is exact in Double, unlike `value + 0.5`,
/// which rounds 0.49999999999999994 up to 1.
func jsRound(_ value: Double) -> Int {
  let floor = value.rounded(.down)
  return Int(value - floor >= 0.5 ? floor + 1 : floor)
}
