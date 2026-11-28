import Foundation
import Testing

@testable import PassepartoutKit

struct CollageLayoutTests {
  static let spacings = [0, 1, 57, 149, 150]

  static let realistic: [(Int, Int)] = [
    (4032, 3024), (3024, 4032), (3000, 3000), (1920, 1080), (1080, 1920), (6000, 4000),
    (4000, 6000), (1200, 900), (900, 1600), (5000, 2000), (2000, 5000), (3000, 2000),
  ]

  @Test func onePhotoIsContainedAndCentred() throws {
    let document = try collage([(3000, 2000)], canvas: .portrait3x4, spacing: 57)

    #expect(rects(document) == [PixelRect(x: 57, y: 518, width: 1326, height: 884)])
  }

  @Test func fourSquaresOnASquareCanvasGetTwoRowsOfTwo() throws {
    let document = try collage(
      Array(repeating: (1000, 1000), count: 4), canvas: .square, spacing: 57)

    #expect(
      rects(document) == [
        PixelRect(x: 57, y: 57, width: 635, height: 634),
        PixelRect(x: 749, y: 57, width: 634, height: 634),
        PixelRect(x: 57, y: 748, width: 635, height: 634),
        PixelRect(x: 749, y: 748, width: 634, height: 634),
      ])
  }

  @Test func spacingZeroLeavesNoWhiteBetweenPhotos() throws {
    let document = try collage(
      Array(repeating: (1000, 1000), count: 4), canvas: .square, spacing: 0)

    #expect(
      rects(document) == [
        PixelRect(x: 0, y: 0, width: 720, height: 720),
        PixelRect(x: 720, y: 0, width: 720, height: 720),
        PixelRect(x: 0, y: 720, width: 720, height: 720),
        PixelRect(x: 720, y: 720, width: 720, height: 720),
      ])
  }

  @Test func tiesGoToFewerRowsThenToLargerPhotosFirst() throws {
    let twoSquares = try collage([(800, 800), (800, 800)], canvas: .square, spacing: 0)
    #expect(
      rects(twoSquares) == [
        PixelRect(x: 0, y: 360, width: 720, height: 720),
        PixelRect(x: 720, y: 360, width: 720, height: 720),
      ])

    let fiveLandscapes = try collage(
      Array(repeating: (3000, 2000), count: 5), canvas: .portrait3x4, spacing: 57)
    #expect(rowCounts(fiveLandscapes.layout) == [1, 2, 2])
  }

  @Test(arguments: [
    (12, 3000, 4000), (6, 3000, 4000), (9, 2000, 2000),
  ])
  func manyPhotosGetBalancedRows(count: Int, width: Int, height: Int) throws {
    let document = try collage(
      Array(repeating: (width, height), count: count), canvas: .portrait3x4, spacing: 57)

    let areas = document.layout.cells.map { $0.rect.width * $0.rect.height }
    let largest = try #require(areas.max())
    let smallest = try #require(areas.min())
    #expect(largest <= 3 * smallest, "\(rowCounts(document.layout))")
  }

  @Test func aPanoramaBeyondFiveToOneGetsAFiveToOneCell() throws {
    let document = try collage([(12000, 1000)], canvas: .landscape3x2, spacing: 57)

    #expect(rects(document) == [PixelRect(x: 57, y: 515, width: 2046, height: 409)])
  }

  /// Four squares at 57 px: columns at x 57...692 and 749...1383, rows at y 57...691 and
  /// 748...1382.
  @Test(arguments: [
    (100.0, 100.0, 0), (1000, 100, 1), (100, 1000, 2), (1000, 1000, 3),
    // In the white between two photos and around them.
    (700, 300, 0), (740, 300, 1), (300, 700, 0), (300, 740, 2), (10, 10, 0), (1430, 1430, 3),
    // Outside the canvas, where a finger may end up.
    (-80, 300, 0), (2000, 300, 1), (300, 2000, 2),
  ])
  func aDropLandsOnThePhotoUnderItOrTheNearestOne(x: Double, y: Double, index: Int) throws {
    let document = try collage(
      Array(repeating: (1000, 1000), count: 4), canvas: .square, spacing: 57)

    #expect(document.layout.dropIndex(x: x, y: y) == index)
  }

  @Test func aDropAsFarFromTwoPhotosGoesToTheEarlierOne() throws {
    let document = try collage(
      Array(repeating: (1000, 1000), count: 4), canvas: .square, spacing: 57)

    #expect(document.layout.dropIndex(x: 720.5, y: 300) == 0)
    #expect(document.layout.dropIndex(x: 720.5, y: 719.5) == 0)
  }

  @Test(arguments: CollageCanvas.allCases, spacings)
  func aDropOnTheMiddleOfAPhotoTakesItsPlace(canvas: CollageCanvas, spacing: Int) throws {
    for count in 1...Self.realistic.count {
      let layout = try collage(
        Array(Self.realistic.prefix(count)), canvas: canvas, spacing: spacing
      ).layout
      for (index, cell) in layout.cells.enumerated() {
        let rect = cell.rect
        let x = Double(rect.x) + Double(rect.width) / 2
        let y = Double(rect.y) + Double(rect.height) / 2
        #expect(layout.dropIndex(x: x, y: y) == index, "\(count) photos, \(rect)")
      }
    }
  }

  /// A row is a whole number of pixels high, so its exact height lies in `height..<height + 1`,
  /// and each width is that times the aspect, rounded to a whole pixel.
  @Test(arguments: CollageCanvas.allCases, spacings)
  func cellsKeepThePhotoShapeUpToWholePixels(canvas: CollageCanvas, spacing: Int) throws {
    for count in 1...Self.realistic.count {
      var document = try collage(
        Array(Self.realistic.prefix(count)), canvas: canvas, spacing: spacing)
      document.setShape(.square, of: 0)

      let cells = document.layout.cells
      #expect(cells.count == count)
      for cell in cells {
        let aspect = cell.photo.cellAspect.value
        let width = Double(cell.rect.width)
        let height = Double(cell.rect.height)
        #expect(
          width > aspect * height - 1 && width < aspect * (height + 1) + 1,
          "\(count) photos, aspect \(aspect), \(cell.rect)")
      }
    }
  }

  @Test(arguments: CollageCanvas.allCases, spacings)
  func everyDocumentWithinTheLimitsHasALayout(canvas: CollageCanvas, spacing: Int) throws {
    let tall = Array(repeating: (200, 1000), count: 12)
    let wide = Array(repeating: (1000, 200), count: 12)
    let alternating = (0..<12).map { $0.isMultiple(of: 2) ? (200, 1000) : (1000, 200) }
    let beyondTheLimit = (0..<12).map { $0.isMultiple(of: 3) ? (100, 10_000) : (10_000, 100) }
    var random = SeededRandom(seed: 7)
    let scattered = (0..<12).map { _ in (random.next(in: 200...5000), random.next(in: 200...5000)) }

    for sizes in [tall, wide, alternating, beyondTheLimit, scattered, Self.realistic] {
      for count in 1...CollageDocument.maxPhotoCount {
        let document = try collage(Array(sizes.prefix(count)), canvas: canvas, spacing: spacing)
        let found = violations(of: document.layout, for: document)
        #expect(found.isEmpty, "\(Array(sizes.prefix(count))): \(found)")
      }
    }
  }

  @Test(arguments: CollageCanvas.allCases)
  func theRowSplitChangesAtMostOnceAcrossTheSpacingRange(canvas: CollageCanvas) throws {
    let photoSets: [[(Int, Int)]] = [
      Array(repeating: (3000, 4000), count: 12),
      Array(repeating: (3000, 2000), count: 5),
      [(4032, 3024), (3024, 4032), (3000, 3000), (1920, 1080), (3024, 4032), (4032, 3024)],
      [(3000, 4000), (3000, 4000), (3000, 4000), (6000, 4000), (6000, 4000)],
    ]
    for sizes in photoSets {
      let splits = try CollageSpacing.range.map { spacing in
        rowCounts(try collage(sizes, canvas: canvas, spacing: spacing).layout)
      }
      #expect(splits.allSatisfy { $0.reduce(0, +) == sizes.count })
      let changes = zip(splits, splits.dropFirst()).count { $0 != $1 }
      #expect(changes <= 1, "\(sizes.count) photos: \(Set(splits.map(\.description)))")
    }
  }
}

private func rects(_ document: CollageDocument) -> [PixelRect] {
  document.layout.cells.map(\.rect)
}

private func rows(_ layout: CollageLayout) -> [[PixelRect]] {
  var rows: [[PixelRect]] = []
  for rect in layout.cells.map(\.rect) {
    if let last = rows.last?.last, last.y == rect.y {
      rows[rows.count - 1].append(rect)
    } else {
      rows.append([rect])
    }
  }
  return rows
}

private func rowCounts(_ layout: CollageLayout) -> [Int] {
  rows(layout).map(\.count)
}

/// Every guarantee of the `CollageLayout` doc comment that `layout` breaks.
private func violations(of layout: CollageLayout, for document: CollageDocument) -> [String] {
  let canvas = document.canvas.size
  let spacing = document.spacing.px
  guard layout.canvas == canvas else { return ["canvas \(layout.canvas)"] }
  guard layout.cells.map(\.id) == document.photos.map(\.id) else {
    return ["order \(layout.cells.map(\.id))"]
  }
  let rows = rows(layout)
  guard let firstRow = rows.first, let lastRow = rows.last else { return ["no cells"] }
  var found: [String] = []
  if layout.cells.contains(where: { $0.rect.width < 1 || $0.rect.height < 1 }) {
    found.append("empty cell")
  }
  for row in rows {
    if Set(row.map(\.height)).count != 1 { found.append("uneven row \(row)") }
    for (left, right) in zip(row, row.dropFirst()) where right.x != left.x + left.width + spacing {
      found.append("gap \(left) \(right)")
    }
  }
  for (upper, lower) in zip(rows, rows.dropFirst())
  where lower[0].y != upper[0].y + upper[0].height + spacing {
    found.append("row gap \(upper[0]) \(lower[0])")
  }
  let lefts = Set(rows.map { $0[0].x })
  let rights = Set(rows.compactMap { $0.last.map { $0.x + $0.width } })
  guard lefts.count == 1, rights.count == 1, let left = lefts.first, let right = rights.first
  else { return found + ["ragged rows \(lefts) \(rights)"] }
  let top = firstRow[0].y
  let bottom = lastRow[0].y + lastRow[0].height
  let margins = (
    left: left, right: canvas.width - right, top: top, bottom: canvas.height - bottom
  )
  if min(margins.left, margins.right, margins.top, margins.bottom) < spacing {
    found.append("inside the border \(margins)")
  }
  if abs(margins.left - margins.right) > 1 || abs(margins.top - margins.bottom) > 1 {
    found.append("off centre \(margins)")
  }
  return found
}

/// A linear congruential generator, so the sweep covers the same sizes on every run.
private struct SeededRandom {
  private var state: UInt64

  init(seed: UInt64) {
    state = seed
  }

  mutating func next(in range: ClosedRange<Int>) -> Int {
    state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
    return range.lowerBound + Int((state >> 33) % UInt64(range.count))
  }
}
