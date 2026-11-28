import Foundation

/// The size of a finished collage. Both sides are at least 1440 pixels, which `CollageLayout`
/// relies on.
public enum CollageCanvas: CaseIterable, Sendable {
  case portrait3x4
  case square
  case landscape3x2

  public var size: PixelSize {
    switch self {
    case .portrait3x4: PixelSize(width: 1440, height: 1920)
    case .square: PixelSize(width: 1440, height: 1440)
    case .landscape3x2: PixelSize(width: 2160, height: 1440)
    }
  }
}

/// The white gap in output pixels, between photos and around them. Always inside `range`.
public struct CollageSpacing: Equatable, Sendable {
  public static let range = 0...150
  public let px: Int

  public init(clamping px: Int) {
    self.px = min(max(px, Self.range.lowerBound), Self.range.upperBound)
  }
}

public enum CollageShape: CaseIterable, Sendable {
  case original
  case square
}

/// What a new collage starts with, and all that outlives one collage.
public struct CollageSettings: Equatable, Sendable {
  public var canvas = CollageCanvas.portrait3x4
  public var spacing = CollageSpacing(clamping: defaultBorderPx)
  /// The shape last given to all photos at once.
  public var shape = CollageShape.original

  public init() {}
}

/// Where the settings outlive the app, as two closures so tests can replace it.
public struct CollageSettingsStore: Sendable {
  var load: @Sendable () -> CollageSettings
  var save: @Sendable (CollageSettings) -> Void

  /// Each field is read on its own: a missing, mistyped or unknown value gives that field's
  /// default, and a spacing out of range is clamped. `nil` is the app's standard defaults.
  public static func userDefaults(suiteName: String? = nil) -> CollageSettingsStore {
    // `UserDefaults` is not `Sendable`, so each closure opens the suite by name.
    @Sendable func defaults() -> UserDefaults { UserDefaults(suiteName: suiteName) ?? .standard }
    return CollageSettingsStore(
      load: {
        let defaults = defaults()
        var settings = CollageSettings()
        let canvasName = defaults.object(forKey: canvasKey) as? String
        if let canvas = CollageCanvas.allCases.first(where: { $0.storedName == canvasName }) {
          settings.canvas = canvas
        }
        if let spacing = defaults.object(forKey: spacingKey) as? Int {
          settings.spacing = CollageSpacing(clamping: spacing)
        }
        let shapeName = defaults.object(forKey: shapeKey) as? String
        if let shape = CollageShape.allCases.first(where: { $0.storedName == shapeName }) {
          settings.shape = shape
        }
        return settings
      },
      save: { settings in
        let defaults = defaults()
        defaults.set(settings.canvas.storedName, forKey: canvasKey)
        defaults.set(settings.spacing.px, forKey: spacingKey)
        defaults.set(settings.shape.storedName, forKey: shapeKey)
      }
    )
  }
}

private let canvasKey = "collage.canvas"
private let spacingKey = "collage.spacing"
private let shapeKey = "collage.shape"

extension CollageCanvas {
  fileprivate var storedName: String {
    switch self {
    case .portrait3x4: "3:4"
    case .square: "1:1"
    case .landscape3x2: "3:2"
    }
  }
}

extension CollageShape {
  fileprivate var storedName: String {
    switch self {
    case .original: "original"
    case .square: "square"
    }
  }
}
