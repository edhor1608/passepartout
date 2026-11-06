import Foundation
import Testing

@testable import PassepartoutKit

/// tests/layout_parity.test.ts (Bun) generates the fixture from the TypeScript layout and fails
/// when it is stale. This suite fails when the Swift port disagrees with it.
struct FrameLayoutParityTests {
  struct Fixture: Decodable {
    struct Case: Decodable {
      struct Input: Decodable {
        let sourceWidth: Int
        let sourceHeight: Int
        let borderPx: Int
      }
      let input: Input
      let layout: FrameLayout?
      let error: FrameLayoutError?
    }
    let defaultBorderPx: Int
    let cases: [Case]
  }

  static func loadFixture() throws -> Fixture {
    let url = try #require(Bundle.module.url(forResource: "layout-parity", withExtension: "json"))
    return try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: url))
  }

  @Test func everyFixtureCaseMatchesTheTypeScriptLayout() throws {
    let fixture = try Self.loadFixture()
    #expect(fixture.cases.count > 3000)
    for testCase in fixture.cases {
      let input = testCase.input
      let actual = Result { () throws(FrameLayoutError) in
        try FrameLayout(
          sourceWidth: input.sourceWidth, sourceHeight: input.sourceHeight, borderPx: input.borderPx
        )
      }
      let expected: Result<FrameLayout, FrameLayoutError>? =
        testCase.layout.map { .success($0) } ?? testCase.error.map { .failure($0) }
      #expect(actual == expected, "\(input)")
    }
  }

  @Test func defaultBorderMatchesTheCLI() throws {
    #expect(defaultBorderPx == (try Self.loadFixture()).defaultBorderPx)
  }

  @Test(arguments: [
    (0.5, 1), (1.5, 2), (2.5, 3), (-0.5, 0), (-1.5, -1), (0.49999999999999994, 0),
  ])
  func jsRoundTiesTowardPositiveInfinity(value: Double, expected: Int) {
    #expect(jsRound(value) == expected)
  }
}
