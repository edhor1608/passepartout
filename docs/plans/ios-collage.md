# iOS Collage mode

## Red-green evidence

Kit tests run with `make -C ios test` (Swift Testing on the Mac host) unless noted. Focused runs use
`swift test --package-path ios/PassepartoutKit --scratch-path ios/.build/SwiftPM --filter <Suite>`.

### Unit 0: extract `PhotoPixels.swift` and `OriginalTransfer.swift`

Behaviour-preserving refactor, so no red phase. The only test edit is the `decodeLongEdge` call site in
`PhotoFramerTests`, which follows the new parameters with the same expected numbers.

- Before: `make -C ios test`: 34 tests in 4 suites passed.
- After: `make -C ios test`: 34 tests in 4 suites passed.

### Unit 1: `CollageSettings` and `CollageSettingsStore`

- Red, against stubs (every canvas 1440x1920, spacing not clamped, a store that keeps nothing):
  `--filter CollageSettings`: 8 tests in 2 suites failed with 20 issues. Failing:
  `everyCanvasHasItsInstagramSize` (3 of 4 canvases), `spacingIsClampedToItsRange` (-5, 999),
  `everyValueRoundTrips` (8 of 8), `readsTheStoredCanvasNames` (3 of 4), `aBrokenValueFallsBackForItsFieldOnly`
  (`settings.shape == .square`), `aStoredSpacingIsClamped` (3 of 3). The two default tests pass against the stub by
  construction.
- Green: `--filter CollageSettings`: 8 tests in 2 suites passed.
