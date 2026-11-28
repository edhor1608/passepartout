import Foundation
import Testing

@testable import PassepartoutKit

struct CollageSettingsTests {
  @Test func aNewCollageStartsOnThreeToFourWithTheFrameBorderAndOriginalShapes() {
    let settings = CollageSettings()

    #expect(settings.canvas == .portrait3x4)
    #expect(settings.spacing.px == 57)
    #expect(settings.shape == .original)
  }

  @Test(arguments: [
    (CollageCanvas.portrait3x4, 1440, 1920), (.square, 1440, 1440), (.landscape3x2, 2160, 1440),
  ])
  func everyCanvasHasItsInstagramSize(canvas: CollageCanvas, width: Int, height: Int) {
    #expect(canvas.size == PixelSize(width: width, height: height))
  }

  @Test func theFormatsAreThreeToFourSquareAndThreeToTwo() {
    #expect(CollageCanvas.allCases == [.portrait3x4, .square, .landscape3x2])
  }

  @Test(arguments: [(-5, 0), (0, 0), (57, 57), (150, 150), (999, 150)])
  func spacingIsClampedToItsRange(requested: Int, px: Int) {
    #expect(CollageSpacing(clamping: requested).px == px)
  }
}

final class CollageSettingsStoreTests {
  let suiteName = "PassepartoutKitTests.\(UUID().uuidString)"
  let defaults: UserDefaults

  init() throws {
    defaults = try #require(UserDefaults(suiteName: suiteName))
  }

  deinit {
    defaults.removePersistentDomain(forName: suiteName)
  }

  var store: CollageSettingsStore { .userDefaults(suiteName: suiteName) }

  @Test func nothingStoredGivesTheDefaults() {
    #expect(store.load() == CollageSettings())
  }

  @Test(arguments: CollageCanvas.allCases, CollageShape.allCases)
  func everyValueRoundTrips(canvas: CollageCanvas, shape: CollageShape) {
    var settings = CollageSettings()
    settings.canvas = canvas
    settings.spacing = CollageSpacing(clamping: 12)
    settings.shape = shape

    store.save(settings)

    #expect(store.load() == settings)
  }

  @Test(arguments: [
    ("3:4", CollageCanvas.portrait3x4), ("1:1", .square), ("3:2", .landscape3x2),
  ])
  func readsTheStoredCanvasNames(stored: String, canvas: CollageCanvas) {
    defaults.set(stored, forKey: "collage.canvas")

    #expect(store.load().canvas == canvas)
  }

  /// 4:5 was a format until the editor redesign. Its stored name is unknown now.
  @Test func aStoredFourToFiveOpensTheNextCollageOnThreeToFour() {
    defaults.set("4:5", forKey: "collage.canvas")
    defaults.set(20, forKey: "collage.spacing")

    let settings = store.load()

    #expect(settings.canvas == .portrait3x4)
    #expect(settings.spacing.px == 20)
  }

  @Test func aBrokenValueFallsBackForItsFieldOnly() {
    defaults.set("16:9", forKey: "collage.canvas")
    defaults.set("abc", forKey: "collage.spacing")
    defaults.set("square", forKey: "collage.shape")

    let settings = store.load()

    #expect(settings.canvas == .portrait3x4)
    #expect(settings.spacing.px == 57)
    #expect(settings.shape == .square)
  }

  @Test(arguments: [(999, 150), (-3, 0), (20, 20)])
  func aStoredSpacingIsClamped(stored: Int, px: Int) {
    defaults.set(stored, forKey: "collage.spacing")

    #expect(store.load().spacing.px == px)
  }
}
