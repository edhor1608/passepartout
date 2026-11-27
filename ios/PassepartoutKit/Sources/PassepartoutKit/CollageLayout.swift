import Foundation

/// Where each photo goes on the canvas, in canvas pixels.
///
/// For every document:
/// - cells keep the document's order, left to right, top to bottom;
/// - cells in a row share one height and are exactly `spacing` apart, and so are the rows;
/// - every row starts and ends at the same x, and the block of rows is centred at least
///   `spacing` from each edge;
/// - every cell is at least 1 pixel wide and high.
///
/// Of all ways to cut the ordered photos into consecutive rows, the layout takes the one with the
/// largest geometric mean of photo areas at the largest block that fits. Equal means go to fewer
/// rows, then to fewer photos in the first rows.
public struct CollageLayout: Sendable {
  public struct Cell: Identifiable, Sendable {
    public let photo: CollagePhoto
    public let rect: PixelRect

    public var id: CollagePhoto.ID { photo.id }
  }

  public let canvas: PixelSize
  public let cells: [Cell]

  init(_ document: CollageDocument) {
    let canvas = document.canvas.size
    let spacing = document.spacing.px
    let aspects = Aspects(document.photos.map(\.cellAspect.value))
    let inner = PixelSize(width: canvas.width - 2 * spacing, height: canvas.height - 2 * spacing)

    var best: Candidate?
    var cuts = 0
    while cuts < 1 << (aspects.count - 1) {
      defer { cuts += 1 }
      let candidate = Candidate(cuts: cuts, aspects: aspects, inner: inner, spacing: spacing)
      guard let candidate else { continue }
      if let current = best, !candidate.beats(current, photoCount: aspects.count) { continue }
      best = candidate
    }
    // The bounds of the canvas, the spacing, the photo count and `AspectRatio` leave a split
    // that fits, and `CollageLayoutTests` sweeps them.
    guard let best else { preconditionFailure("no row split fits \(aspects.values) on \(canvas)") }

    let rows = rowRanges(cuts: best.cuts, photoCount: aspects.count)
    let rowGaps = (rows.count - 1) * spacing
    func rowHeights(blockWidth: Int) -> [Int] {
      rows.map { row in
        let height = Double(blockWidth - (row.count - 1) * spacing) / aspects.sum(row)
        return Int(height.rounded(.down))
      }
    }
    var blockWidth = Int(best.blockWidth.rounded(.down))
    var heights = rowHeights(blockWidth: blockWidth)
    // Floating-point rounding can push a floored row height over by one pixel.
    while heights.reduce(0, +) + rowGaps > inner.height {
      blockWidth -= 1
      heights = rowHeights(blockWidth: blockWidth)
    }

    let left = (canvas.width - blockWidth) / 2
    var y = (canvas.height - heights.reduce(0, +) - rowGaps) / 2
    var cells: [Cell] = []
    for (row, height) in zip(rows, heights) {
      let widths = apportion(
        blockWidth - (row.count - 1) * spacing, weights: Array(aspects.values[row]))
      var x = left
      for (index, width) in zip(row, widths) {
        cells.append(
          Cell(
            photo: document.photos[index],
            rect: PixelRect(x: x, y: y, width: width, height: height)))
        x += width + spacing
      }
      y += height + spacing
    }
    self.canvas = canvas
    self.cells = cells
  }
}

/// A row is the photos `start..<end`.
private struct Aspects {
  let values: [Double]
  private let prefixSums: [Double]

  init(_ values: [Double]) {
    self.values = values
    var running = 0.0
    prefixSums =
      [0]
      + values.map { value in
        running += value
        return running
      }
  }

  var count: Int { values.count }

  func sum(_ row: Range<Int>) -> Double { sum(row.lowerBound, row.upperBound) }

  func sum(_ start: Int, _ end: Int) -> Double { prefixSums[end] - prefixSums[start] }

  func narrowest(_ start: Int, _ end: Int) -> Double {
    var narrowest = values[start]
    var index = start + 1
    while index < end {
      narrowest = min(narrowest, values[index])
      index += 1
    }
    return narrowest
  }
}

/// One way to cut the ordered photos into consecutive rows, at the widest block that fits.
/// Bit `i` of `cuts` ends a row after photo `i`. The search evaluates up to 2048 of them on
/// every edit, so evaluating one allocates nothing and loops over plain integers, which stay
/// fast in debug builds too.
private struct Candidate {
  let cuts: Int
  let rowCount: Int
  let blockWidth: Double
  /// The log of the product of all photo heights, which ranks splits like the geometric mean of
  /// photo areas does.
  let score: Double

  /// `nil` when a row would be too low or a photo too narrow to keep one pixel after rounding.
  init?(cuts: Int, aspects: Aspects, inner: PixelSize, spacing: Int) {
    let count = aspects.count
    func rowEnd(from start: Int) -> Int {
      var end = start + 1
      while end < count, cuts & (1 << (end - 1)) == 0 { end += 1 }
      return end
    }

    // Row r is (W - gaps_r) / sum_r high at block width W, so the block height is linear in W.
    var rowCount = 0
    var inverseSums = 0.0
    var gapOffset = 0.0
    var start = 0
    while start < count {
      let end = rowEnd(from: start)
      let sum = aspects.sum(start, end)
      rowCount += 1
      inverseSums += 1 / sum
      gapOffset += Double((end - start - 1) * spacing) / sum
      start = end
    }
    let heightBound =
      (Double(inner.height - (rowCount - 1) * spacing) + gapOffset) / inverseSums
    let blockWidth = min(Double(inner.width), heightBound)

    var score = 0.0
    start = 0
    while start < count {
      let end = rowEnd(from: start)
      let height = (blockWidth - Double((end - start - 1) * spacing)) / aspects.sum(start, end)
      guard height >= AspectRatio.limit + 1, aspects.narrowest(start, end) * height >= 2 else {
        return nil
      }
      score += Double(end - start) * log(height)
      start = end
    }
    self.cuts = cuts
    self.rowCount = rowCount
    self.blockWidth = blockWidth
    self.score = score
  }

  func beats(_ other: Candidate, photoCount: Int) -> Bool {
    // The same rows in another order score equal up to rounding noise.
    if abs(score - other.score) > 1e-9 { return score > other.score }
    if rowCount != other.rowCount { return rowCount < other.rowCount }
    let counts = rowRanges(cuts: cuts, photoCount: photoCount).map(\.count)
    let otherCounts = rowRanges(cuts: other.cuts, photoCount: photoCount).map(\.count)
    return counts.lexicographicallyPrecedes(otherCounts)
  }
}

private func rowRanges(cuts: Int, photoCount: Int) -> [Range<Int>] {
  var rows: [Range<Int>] = []
  var start = 0
  for end in 1...photoCount where end == photoCount || cuts & (1 << (end - 1)) != 0 {
    rows.append(start..<end)
    start = end
  }
  return rows
}

/// Splits `total` into integers proportional to `weights` that add up to exactly `total`: floors
/// first, then one more each to the largest remainders, earlier entries first on a tie.
private func apportion(_ total: Int, weights: [Double]) -> [Int] {
  let sum = weights.reduce(0, +)
  let exact = weights.map { Double(total) * $0 / sum }
  var shares = exact.map { Int($0.rounded(.down)) }
  let remainders = zip(exact, shares).map { $0 - Double($1) }
  let byRemainder = shares.indices.sorted { first, second in
    remainders[first] != remainders[second]
      ? remainders[first] > remainders[second] : first < second
  }
  for index in byRemainder.prefix(total - shares.reduce(0, +)) { shares[index] += 1 }
  return shares
}
