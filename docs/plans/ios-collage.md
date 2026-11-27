# iOS Collage mode

## Red-green evidence

Kit tests run with `make -C ios test` (Swift Testing on the Mac host) unless noted. Focused runs use
`swift test --package-path ios/PassepartoutKit --scratch-path ios/.build/SwiftPM --filter <Suite>`.

### Unit 0: extract `PhotoPixels.swift` and `OriginalTransfer.swift`

Behaviour-preserving refactor, so no red phase. The only test edit is the `decodeLongEdge` call site in
`PhotoFramerTests`, which follows the new parameters with the same expected numbers.

- Before: `make -C ios test`: 34 tests in 4 suites passed.
- After: `make -C ios test`: 34 tests in 4 suites passed.
