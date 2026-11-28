import PassepartoutKit

extension CollageCanvas {
  var label: String {
    switch self {
    case .portrait3x4: "3:4"
    case .square: "1:1"
    case .landscape3x2: "3:2"
    }
  }

  var spokenName: String {
    switch self {
    case .portrait3x4: "Hochformat 3 zu 4"
    case .square: "Quadrat 1 zu 1"
    case .landscape3x2: "Querformat 3 zu 2"
    }
  }
}

extension CollageShape {
  var label: String {
    switch self {
    case .original: "Original"
    case .square: "Quadrat"
    }
  }
}
