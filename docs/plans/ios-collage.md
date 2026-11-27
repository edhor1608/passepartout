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

### Unit 2: `CollageDocument` and `CollageLayout`

- Red, against stubs (a layout with no cells, a document that takes any photo count, ignores `settings.shape` and
  whose edits do nothing): `--filter 'CollageDocument|CollageLayout'`: 17 tests, 14 failed with 1467 issues.
  `acceptsOneToTwelvePhotos` passes against the stub by construction.
- The red run showed two hollow tests: `cellsKeepThePhotoShape` and `theRowSplitChangesAtMostOnce…` passed on an
  empty layout. Both now first assert the cell count. Re-run: all 9 layout tests failed with 1705 issues.
- First green attempt: 4 failures in `cellsKeepThePhotoShape` at spacing 149 and 150, for example a 77 x 190 cell for
  a 2:5 photo (1.3 % off). A 1 % bound is wrong for cells under 100 px. The test now states the real guarantee:
  the exact row height lies in `height..<height + 1` and each width rounds to a whole pixel
  (`cellsKeepThePhotoShapeUpToWholePixels`).
- Green: `--filter 'CollageDocument|CollageLayout'`: 17 tests in 2 suites passed.
- Speed, CPU time from `clock()` because the host ran at load average 300 from other agents' TLC runs: one
  12-photo layout took 36 ms in a debug build with `Range` iteration in the search, 4.8 ms with integer loops.
  `make -C ios run` builds Debug, so the slider stays inside a 60 fps frame in the simulator.

### Unit 3: renderer (`readOriginal`, `renderCollage`)

- Red, against stubs (`readOriginal` returns a 1 x 1 size and a full-size preview, `renderCollage` returns an empty
  white canvas): `--filter CollageRenderer`: 8 tests, 7 failed with 60 issues. `readingAFileImageIOCannotReadFails`
  passes against the stub, which opens the file too. `writesABaselineSRGBJPEGWithoutSourceMetadata` fails only on
  its Display P3 pixel probe, since an empty canvas carries no metadata either.
- Green: `--filter 'CollageRenderer|FrameLayoutParity|PhotoFramer'`: 23 tests in 3 suites passed. The parity and
  framer suites cover the move of `centeredCoverCrop` to `PixelSize`.

### Unit 4: `CollageSession`

- Red, against a stub whose calls do nothing: `--filter CollageSession`: 25 tests, 24 failed with 44 issues.
  `closingThePickerWithoutAPickReturnsToStart` passes against the stub, which never leaves `start`.
- Green: `--filter CollageSession`: 25 tests passed. Five repeated runs of `--filter 'CollageSession|FramingSession'`:
  44 tests in 3 suites passed each time. `make -C ios test`: 92 tests in 10 suites passed.
