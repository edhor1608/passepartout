// swift-tools-version: 6.2
import PackageDescription

// macOS is a test host only, so `swift test` runs every test on the Mac in seconds.
let strict: [SwiftSetting] = [.treatAllWarnings(as: .error)]

let package = Package(
  name: "PassepartoutKit",
  platforms: [.iOS(.v26), .macOS(.v26)],
  products: [.library(name: "PassepartoutKit", targets: ["PassepartoutKit"])],
  targets: [
    .target(name: "PassepartoutKit", swiftSettings: strict),
    .testTarget(
      name: "PassepartoutKitTests",
      dependencies: ["PassepartoutKit"],
      resources: [.copy("Resources/layout-parity.json")],
      swiftSettings: strict
    ),
  ]
)
