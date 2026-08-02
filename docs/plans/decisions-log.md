# Decisions Log

## 2026-05-11: Narrow v1 to PNG-to-Instagram image export

Partially superseded by "2026-05-14: Accept PNG, JPEG, and TIFF source images." V1 is source-image-to-Instagram-image, not PNG-only.

### Context

The current repo contains a broad Instagram media export lab with recommendation, analysis, image export, video export, reporting, benchmarking, validation matrices, watch-folder automation, overlays, and grid previews. The intended first production version is much smaller.

### Decision

v1 is scoped to converting one PNG input into one ready-to-upload Instagram image output. It should optimize the final image format, dimensions, and aspect ratio for Instagram image quality. v1 also includes an option to place the image on a solid white canvas so the output reaches the correct target aspect ratio without cropping.

### Rationale

This matches the actual product need and avoids shipping lab surfaces as if they were production features. The white-canvas behavior is core because simply adding a fixed border does not guarantee the final image reaches the correct Instagram aspect ratio.

### Consequences

Video export, benchmarking, validation matrices, watch-folder automation, overlay guides, grid previews, and experimental research workflows are not v1 product surface unless explicitly re-added later. The split pass should preserve useful work on a follow-up branch, but v1 should be cut around the PNG-to-upload-image workflow.

## 2026-05-11: Target manual Instagram app upload for v1

### Context

Instagram app upload and scheduler/API upload have different practical constraints. The current repo has both `app_direct` and `api_scheduler` workflow concepts, including API-oriented checks such as the 8 MiB image baseline.

### Decision

v1 targets manual upload through the Instagram app. Scheduler/API upload compatibility is out of scope for v1.

### Rationale

The user wants a direct path from a PNG they want to post to an Instagram-ready image. Manual app upload is the actual workflow, so keeping API scheduler constraints in the v1 product would add decisions and warnings that do not serve the first release.

### Consequences

The v1 split should keep only the app-direct image path. API scheduler policy, API file-size checks, and scheduler-specific workflow warnings should move to the saved-work branch unless reused internally for tests or documentation.

## 2026-05-11: Preserve landscape sources as real landscape outputs

### Context

The v1 product needs portrait and landscape variants. Earlier discussion considered putting landscape sources onto a portrait `3:4` canvas for grid consistency, but the desired behavior is a real landscape image post with white padding/border where needed. Instagram's profile-grid preview can be adjusted separately through Instagram's own setting.

### Decision

For v1, landscape sources stay landscape outputs. The source image is preserved without cropping, and white padding/border may be added while keeping the final output in a valid landscape Instagram aspect ratio.

### Rationale

This matches the user's intended posting workflow: landscape photos should remain landscape photos. The profile-grid display concern should not distort the exported file or force a portrait canvas.

### Consequences

The v1 split needs a real landscape output path. Portrait and landscape variants may use different target dimensions, while both should preserve the source composition and avoid cropping.

## 2026-05-11: Use 2160x1440 landscape and 1440x1920 portrait as v1 targets

Partially superseded by "2026-05-14: Do not upscale small source images." These are maximum targets, not mandatory output sizes when they would require upscaling.

### Context

Official Instagram help still describes best-resolution photo uploads as up to `1080px` wide, but the project is targeting manual app upload and best practical image quality. User-provided research from Stephen Knight Photography and NoirAngelPhotography argues that larger current Instagram uploads can preserve more detail in current behavior. The target values are now fixed by product decision.

### Decision

v1 uses `2160x1440` for landscape and `1440x1920` for portrait as the fixed output targets for manual Instagram app upload. Outputs should be converted/exported in sRGB and should not exceed the target dimensions.

### Rationale

The goal is best practical quality for manual app upload, not official-minimum compatibility. Fixed target sizes keep the export behavior predictable and avoid avoidable extra downscaling from larger-than-target exports.

### Consequences

This supersedes the brief `1440x1800` portrait target. The v1 split should remove or hide older `1080x1350`, `1080x1440`, and experimental target profiles from the production path unless they are kept only in saved-work research.

## 2026-05-11: Limit v1 to two output shapes

Partially superseded by "2026-05-14: Do not upscale small source images" and "2026-05-14: Use integer output dimensions that preserve target ratios." V1 has two output ratios, with maximum target sizes.

### Context

The existing repo has many target profiles across feed/story/reel, portrait/square/landscape, reliable/experimental, app-direct/API, and white-canvas variants. The intended v1 should stay simple and predictable.

### Decision

v1 has only two output shapes: `2160x1440` for landscape and `1440x1920` for portrait. Every input image is fit into one of these canvases without cropping, with white padding when needed.

### Rationale

Two fixed shapes make the product easy to understand, test, and split from the existing lab code. It also avoids preserving the broad profile matrix as production complexity.

### Consequences

Square-specific, story, reel, API-safe, experimental, and arbitrary aspect-ratio targets are out of v1. They can stay on the saved-work branch.

## 2026-05-11: Auto-detect portrait vs landscape by default

### Context

The v1 product has exactly two output shapes. The tool needs a default way to choose between them without adding unnecessary user choices.

### Decision

v1 auto-detects the output variant from the input image dimensions after applying EXIF orientation by default. If the source width is greater than its height, use the landscape target. Otherwise, use the portrait target. Square inputs use the portrait target.

### Rationale

Auto-detection keeps v1 simple for the common path: the user gives the tool a PNG and gets a ready-to-upload image. An explicit override can be added later if real cases require it.

### Consequences

The v1 CLI does not need a required orientation flag. Any existing mode/surface/orientation matrix should be removed or hidden from the production path.

## 2026-05-14: Confirm v1 default target rule

Partially superseded by "2026-05-14: Do not upscale small source images." The rule chooses the maximum target ratio and size; small images may export smaller.

### Context

The v1 target sizes and orientation auto-detection needed to be stated as an exact rule for implementation.

### Decision

Default v1 target selection is:

- If source `width > height`, use landscape `2160x1440`.
- Otherwise, use portrait `1440x1920`.

Use sRGB, target manual Instagram app upload, and do not export larger than the selected target canvas.

### Rationale

This is the simplest rule that supports the two required v1 variants while keeping the no-crop white-canvas behavior deterministic.

### Consequences

Square inputs use the portrait target by default. Any future manual override should be explicit and should not complicate the default source-image-to-ready-image path.

## 2026-05-14: Always render v1 outputs on a white canvas

Partially superseded by "2026-05-14: Allow zero border override." White canvas remains the default visual style, but `--border-px 0` can make the border invisible.

### Context

White canvas was previously treated as an optional correction for reaching the target aspect ratio without cropping. The intended v1 product uses the white canvas as part of the visual style.

### Decision

Every v1 output is rendered on a solid white target canvas. The source image is fit inside that canvas without cropping.

### Rationale

The white canvas creates the desired polaroid-ish look and makes the Instagram profile feel like one consistent large white canvas with images attached to it. This is a product identity choice, not only a technical aspect-ratio fix.

### Consequences

V1 does not need a no-canvas export mode. Existing optional white-canvas flags should be removed or hidden from the production path during the split.

## 2026-05-14: Use fixed final targets with adaptive minimum border fitting

Superseded by "2026-05-14: Do not upscale small source images." The maximum targets remain, but final outputs may be smaller to avoid upscaling.

### Context

The final export must keep the exact v1 target dimensions: `2160x1440` for landscape and `1440x1920` for portrait. The user also wants to define a minimum white border, while the tool handles different source image aspect ratios automatically.

### Decision

V1 uses fixed final canvas dimensions and an adaptive fit algorithm:

- choose the target canvas from the source orientation,
- reserve at least the configured minimum white border,
- scale the source image as large as possible inside the remaining area without cropping,
- center the fitted source image on the white canvas,
- export the exact target dimensions in sRGB.

### Rationale

This preserves the required final export pixels while making the white-border look automatic across arbitrary PNG aspect ratios. A fixed pixel border alone would not reliably produce the correct final aspect ratio or consistent composition.

### Consequences

The split pass needs a small layout function that returns canvas size, fitted image size, and offsets. Tests should cover landscape, portrait, square, very wide, and very tall inputs against fixed target dimensions and minimum-border invariants.

## 2026-05-14: Define minimum white border in pixels

### Context

The v1 output canvases have fixed pixel dimensions, so the minimum white border needs a unit that is predictable at export time.

### Decision

The v1 minimum white border is defined in pixels.

### Rationale

Pixel units match the fixed final canvases and make outputs easy to inspect. Percent-based borders would be less direct for a tool whose export contract is exact pixel dimensions.

### Consequences

The implementation should accept or configure a pixel value and enforce it on all four sides before fitting the source image. A separate decision is still needed for the default border value.

## 2026-05-14: Use 165px as the default minimum border

### Context

The desired visual border was given as `124pt`, but the export layout works in image pixels.

### Decision

Use `165px` as the v1 default minimum white border. This converts `124pt` using the normal digital conversion `1pt = 96 / 72px`, giving `165.33px`, rounded to the nearest whole pixel.

### Rationale

The output pipeline needs integer pixel dimensions and offsets. `165px` preserves the requested `124pt` visual intent while keeping the layout deterministic.

### Consequences

The fit algorithm should reserve at least `165px` on all four sides by default before scaling the source image into the remaining area.

Superseded by the later real-image comparison decision below.

## 2026-05-14: Use 57px as the default final export border

### Context

Testing `prepare-image` with `/Users/jonas/FotoDump101/DSCF7862.JPG` showed that `165px` on the final `2160x1440` export was visually too large. The intended `165px` value was closer to a source-scale reference on a `6240x4160` file.

### Decision

Use `57px` as the v1 default border.

### Rationale

`165 * 2160 / 6240 = 57.1`, so `57px` matches the intended visual border on the final landscape export while keeping `--border-px` semantics simple: one integer pixel value on the final full-size target.

### Consequences

The CLI default changes to `57px`. Explicit `--border-px` values still work the same way, including `0`.

## 2026-05-14: Landscape outputs prioritize equal outer border

### Context

The earlier v1 default-border candidate was `165px` on all sides, but simply adding an equal border around a same-ratio image changes the final aspect ratio. For example, a landscape source around `6494x4330` and a final `2160x1440` export both have about the same `3:2` shape. If the export must remain `2160x1440`, an equal `165px` border creates an inner image frame of `1830x1110`, which is a wider ratio than the source. A pure no-crop contain fit would create uneven white borders.

### Decision

For landscape v1 outputs, keep the final canvas at `2160x1440` and use an equal configured outer border on all four sides by default. The source image should fill the inner frame; if needed, crop slightly inside the image rather than making the outer border uneven.

For portrait v1 outputs, keep no-crop fitting with at least the minimum border. Uneven side padding is acceptable because portrait compositions do not visually compare the side and top/bottom borders in the same way.

### Rationale

The landscape visual goal is an even white outer border. Losing a small number of source pixels is preferable to producing visibly uneven borders on landscape images. Portrait outputs can keep the original composition without making the border look wrong.

### Consequences

The v1 layout function needs separate fit modes:

- landscape: cover the equal-border inner frame and crop if required,
- portrait: contain within the fixed canvas while respecting the minimum border.

Tests should include a `6494x4330`-style landscape input and assert final `2160x1440`, equal configured outer border, and centered crop.

Superseded detail: the active default border is now `57px`; `165px` was the earlier source-scale reference.

## 2026-05-14: Use centered crop for landscape equal-border fitting

### Context

Landscape outputs may need slight cropping to preserve an equal outer border while still exporting the exact `2160x1440` canvas.

### Decision

Use centered crop only for v1 landscape equal-border fitting.

### Rationale

Centered crop keeps the output deterministic and avoids adding focal-point controls or image-specific positioning decisions to v1.

### Consequences

The v1 implementation should not include focal-point controls. Those can be preserved or added later if real images show the centered crop is insufficient.

## 2026-05-14: Use centered contain fit for portrait outputs

### Context

Portrait outputs do not need the same equal-border crop rule as landscape outputs. Wider side padding is visually acceptable, and preserving the full portrait image is more important.

### Decision

Portrait v1 outputs use contain fit. Preserve the full source image, center it horizontally and vertically on the `1440x1920` white canvas, and keep at least the configured minimum border.

### Rationale

This keeps portrait handling predictable and avoids losing image content. Uneven side padding is acceptable because viewers do not compare it against the top/bottom margins in the same way as landscape borders.

### Consequences

The layout function should branch by target variant: landscape uses centered cover into the equal-border inner frame, portrait uses centered contain within the minimum-border safe area.

## 2026-05-14: Export high-quality sRGB JPEG

### Context

The v1 input is a PNG, but the final artifact should be optimized for manual Instagram photo upload.

### Decision

V1 exports a high-quality sRGB JPEG.

### Rationale

Instagram will recompress uploaded images, and JPEG is the normal photo upload format. Keeping the output sRGB avoids color surprises in the app upload path.

### Consequences

PNG remains the v1 input format, not the output format. The split pass should remove or hide output-format choice from the v1 path unless later evidence requires it.

## 2026-05-14: Use baseline JPEG encoding

### Context

V1 exports JPEG, but progressive versus baseline encoding needed to be decided.

### Decision

V1 exports baseline JPEG.

### Rationale

Instagram will process uploaded images anyway, and baseline JPEG avoids compatibility surprises. High-quality encoding and sRGB output are the more important constraints.

### Consequences

The FFmpeg export settings should avoid progressive JPEG output.

## 2026-05-14: Use highest JPEG quality for v1

### Context

V1 has a fixed output format and does not expose a quality option.

### Decision

V1 uses the highest practical JPEG quality setting in the FFmpeg export path.

### Rationale

The goal is best practical quality for manual Instagram app upload. File size constraints for scheduler/API upload are out of v1 scope.

### Consequences

JPEG quality should be an internal constant, not a CLI flag. Tests should assert the configured FFmpeg arguments rather than exposing quality as user choice.

## 2026-05-14: Do not optimize for output file size in v1

### Context

V1 targets manual Instagram app upload and highest-quality JPEG output. API/scheduler file-size constraints are out of scope.

### Decision

V1 does not optimize for output file size.

### Rationale

The product goal is image quality, not meeting scheduler/API size limits or minimizing storage.

### Consequences

The split pass should remove or hide API image-size checks from the production v1 path. File-size warnings are not part of v1.

## 2026-05-14: Treat layout math as core v1 test surface

### Context

The current repo has broad e2e and snapshot coverage, but v1's product value is concentrated in deterministic layout and output-path behavior.

### Decision

Before or during the split, add focused unit tests for:

- landscape cover/crop with equal border,
- portrait contain fit,
- small no-upscale shrink,
- proportional border scaling,
- square-to-portrait auto-detection,
- `0px` border,
- output path suffixing.

### Rationale

The layout math is the product. Focused tests make it safer to remove broad lab surfaces and snapshots from v1.

### Consequences

The v1 split should prioritize a small pure layout module with direct tests, plus minimal integration coverage proving FFmpeg output dimensions and path handling.

## 2026-05-14: Accept PNG, JPEG, and TIFF source images

### Context

The initial v1 wording said PNG input, but the actual workflow should accept common still-photo source formats. The local FFmpeg build supports decoding PNG, JPEG, and TIFF.

### Decision

V1 accepts PNG, JPEG, and TIFF source images. It still exports one high-quality sRGB JPEG.

### Rationale

These formats cover the likely source images without expanding v1 into broad media handling. TIFF support is practical because it is already available through FFmpeg.

### Consequences

The split pass should remove video and broad media-inspection paths from v1, but keep still-image decoding for PNG, JPEG, and TIFF. Tests should include at least one fixture per supported input format.

## 2026-05-14: Strip source image metadata by default

### Context

Research suggests Instagram strips EXIF/XMP from public displayed images, while Meta may still process metadata from the original uploaded file. EXIF/XMP can include private GPS, device, timestamp, and thumbnail data. The clearest quality-related requirement is sRGB output; there is no confirmed evidence that preserving arbitrary EXIF/XMP improves Instagram image processing.

### Decision

V1 strips source EXIF/XMP metadata from the exported JPEG by default, while still ensuring sRGB output.

### Rationale

There is evidence that sRGB output matters for Instagram color behavior, but not that arbitrary metadata improves Instagram processing. Stripping metadata avoids leaking GPS/device/time data to the upload path.

### Consequences

The implementation should strip source EXIF/XMP metadata and keep color handling explicit. Tests should verify that common metadata does not survive in the output where practical.

## 2026-05-14: Do not warn for normal metadata stripping

### Context

V1 strips source metadata by default. The command output is intended to stay plain and useful for scripts.

### Decision

Do not print a warning when metadata is stripped during a successful export.

### Rationale

Metadata stripping is normal v1 behavior, not an exceptional condition.

### Consequences

Successful command output should remain the actual written output path only.

## 2026-05-14: Composite transparency onto white

### Context

V1 exports JPEG, which has no transparency channel, and every v1 output is rendered on a white canvas.

### Decision

Transparent pixels in source images are composited onto white.

### Rationale

This matches the white-canvas product look and prevents unexpected black or undefined transparent areas in the JPEG output.

### Consequences

Transparency handling is normal behavior and should not require a warning.

## 2026-05-14: Apply EXIF orientation before stripping metadata

### Context

V1 strips source metadata by default, but source files may rely on EXIF orientation to display correctly.

### Decision

Respect EXIF orientation visually before stripping metadata. The exported JPEG should contain correctly oriented pixels and should not rely on orientation metadata.

### Rationale

Phone and camera images can otherwise export sideways. Applying orientation first preserves the intended visual result while still removing metadata from the final artifact.

### Consequences

The processing order should be: decode source, apply EXIF orientation, render onto white canvas, export sRGB JPEG, strip output metadata.

## 2026-05-14: Do not upscale small source images

### Context

The v1 export canvases have fixed dimensions, but small source images may be smaller than the computed image placement area.

### Decision

V1 never upscales source images. If the source image is too small for the maximum target canvas, export a smaller canvas with the same target ratio and proportionally equivalent white borders.

### Rationale

Upscaling invents pixels and can reduce perceived quality. For small sources, preserving source pixels and reducing the final canvas is preferable to enlarging them or creating an overly large white canvas.

### Consequences

The layout function should cap source scale at `1` and shrink the output canvas when needed while preserving the landscape or portrait target ratio. Tests should include small landscape and portrait inputs where the output canvas is smaller than the maximum target.

## 2026-05-14: Scale border proportionally for small outputs

### Context

When v1 exports a smaller canvas to avoid upscaling, the white border needs to keep the same visual proportions as the full-size target.

### Decision

Treat the configured border value as the full-target border. If the output canvas shrinks, scale the border by the same factor. For example, a `165px` border becomes about `83px` at `50%` output size.

### Rationale

This preserves the intended white-canvas look across full-size and small-source exports.

### Consequences

The layout function should compute an output scale factor and derive the effective border from it. Tests should assert proportional border scaling for small landscape and portrait sources.

## 2026-05-14: Round scaled borders to integer pixels

### Context

Proportional border scaling can produce fractional pixel values.

### Decision

Round effective scaled borders to the nearest integer pixel, with a minimum of `1px` when the configured border is greater than `0`. If configured border is `0px`, effective border remains `0px`.

### Rationale

Image layout needs integer pixel dimensions, and a positive configured border should stay visible even in very small outputs.

### Consequences

The layout function should centralize effective-border calculation and tests should cover fractional scaling plus the `0px` exception.

## 2026-05-14: Use integer output dimensions that preserve target ratios

### Context

Small-source exports may shrink below the maximum target canvas to avoid upscaling. Those smaller output dimensions still need to preserve the v1 landscape or portrait ratio.

### Decision

For small no-upscale exports, choose integer output dimensions that:

- do not exceed the maximum target,
- do not require upscaling,
- preserve the target ratio exactly when possible.

Landscape outputs should use dimensions that are multiples of `3x2`. Portrait outputs should use dimensions that are multiples of `3x4`.

### Rationale

The v1 ratios are simple, so exact integer-ratio dimensions are practical and avoid subtle aspect drift.

### Consequences

The layout function should choose scaled canvas dimensions on the ratio grid. Tests should verify small landscape and portrait outputs stay on the expected `3:2` or `3:4` ratio.

## 2026-05-14: Use one boring prepare-image command for v1

### Context

The current repo exposes many lab commands: `recommend`, `analyze`, `export-image`, `export-video`, `report`, `benchmark`, `validate-matrix`, `watch-folder`, `overlay`, and `grid-preview`. The v1 product is one source image in and one Instagram-ready JPEG out.

### Decision

V1 should expose one user-facing command, tentatively `prepare-image <input> --out <output>`.

### Rationale

One command matches the product and keeps users out of lab concepts like recommendation profiles, modes, surfaces, workflows, and benchmarks. Analysis and export decisions can still exist internally.

### Consequences

The split pass should move or hide the existing lab command surface from production v1. The v1 CLI should have a small option set around output path and border configuration.

## 2026-05-14: Exclude doctor from v1 product surface

### Context

The current repo includes a `doctor` command for checking local prerequisites and fixtures. V1 should expose one boring user-facing image preparation command.

### Decision

V1 does not include a user-facing `doctor` command.

### Rationale

The product surface should stay focused on preparing one image. Environment checks can remain developer/support tooling if needed, but they are not part of v1.

### Consequences

The split pass should remove or hide `doctor` from the production command list. Any prerequisite checks needed by `prepare-image` should fail inline with concise errors.

## 2026-05-14: Keep FFmpeg as the v1 image engine

### Context

The repo already uses FFmpeg for media export, and v1 needs PNG/JPEG/TIFF decoding, orientation handling, scaling, compositing, color handling, and JPEG output.

### Decision

V1 uses FFmpeg as the image processing engine.

### Rationale

FFmpeg already covers the required image formats and transformations. Replacing it with another image library during the v1 scope split would add unnecessary dependency and behavior risk.

### Consequences

The split pass should keep a small FFmpeg adapter/path for `prepare-image`. Missing or failing FFmpeg should surface as a concise command error.

## 2026-05-14: Limit v1 command options to out and border-px

### Context

The existing lab commands expose many knobs: mode, surface, workflow, profile, quality, ratio, orientation, style, and JSON output. V1 should keep the product path simple.

### Decision

The v1 `prepare-image` command exposes only:

- one positional input path,
- required `--out <path>`,
- optional `--border-px <pixels>`.

It should not expose mode, surface, workflow, profile, quality, ratio, or orientation flags.

### Rationale

The v1 rules already define orientation detection, output dimensions, sRGB JPEG output, and default quality. Extra flags would reintroduce the lab surface that the v1 split is trying to remove.

### Consequences

Implementation should reject unknown flags and keep the CLI help focused on this minimal surface. Internal constants can hold target dimensions, JPEG quality, and color behavior.

## 2026-05-14: Provide minimal prepare-image help output

### Context

The v1 command has a minimal option surface, but users still need discoverability.

### Decision

`prepare-image --help` should print a one-line usage string and only the two v1 options: `--out` and `--border-px`.

### Rationale

This helps users without expanding product scope or exposing lab concepts.

### Consequences

The v1 help output should not mention hidden/internal options, modes, workflows, profiles, JSON, or old lab commands.

## 2026-05-14: Use one integer border value

### Context

The v1 command exposes `--border-px`, but the shape of that value needed to be fixed.

### Decision

`--border-px` accepts one integer pixel value. V1 does not support per-side borders.

Landscape uses the value as the exact equal outer border. Portrait uses the value as the minimum border.

### Rationale

One border value keeps the CLI simple and matches the visual model. Per-side controls would make the first version harder to reason about and test.

### Consequences

The parser should reject non-integer, negative, or too-large border values. The layout code should receive one border value and branch only by output variant.

## 2026-05-14: Allow zero border override

### Context

The white-canvas look is the v1 default, but users may still need an exact target export with no visible border.

### Decision

`--border-px 0` is valid. Border values are non-negative integers, with `57px` as the default.

### Rationale

Allowing zero keeps the command flexible without adding another mode flag. The default still preserves the intended white-canvas style.

### Consequences

Validation should accept `0` and reject negative or non-integer values. Tests should include `--border-px 0`.

## 2026-05-14: Do not overwrite existing outputs by default

### Context

The v1 command only exposes `--out` and `--border-px`. It should protect existing exports without adding another flag.

### Decision

If the requested output file already exists, v1 writes to a suffixed output path instead of overwriting it.

### Rationale

This preserves previous exports and keeps the CLI option surface small. A `--force` flag would add complexity to a workflow that should stay boring.

### Consequences

The implementation needs deterministic suffixing, for example `name-1.jpg`, `name-2.jpg`, and so on. The command output should clearly report the actual written path.

## 2026-05-14: Always print actual written output path

### Context

Because v1 suffixes output paths when the requested destination already exists, the user needs to know where the file was actually written.

### Decision

The v1 command always prints the actual written output path.

### Rationale

This makes suffixing transparent and keeps the command useful in shell scripts.

### Consequences

The v1 command should use plain text output. No JSON output flag is needed for v1.

## 2026-05-14: Print failures to stderr and exit non-zero

### Context

The v1 command output should be useful in shell scripts and predictable for users.

### Decision

On success, print only the actual written path to stdout. On failure, print a concise error to stderr and exit non-zero.

### Rationale

This keeps stdout machine-friendly and makes failures conventional for CLI use.

### Consequences

Implementation should avoid mixing warnings or logs into successful stdout.

## 2026-05-14: Require out to be a full file path

### Context

The v1 command needs an output destination. Allowing `--out` to be either a directory or file path would add naming and extension rules.

### Decision

For v1, `--out` must be a full file path, not a directory.

### Rationale

This keeps suffixing and extension behavior simple. Automatic filename generation can be added later if it becomes useful.

### Consequences

The implementation should reject directory paths for `--out`. It should create missing parent directories only if that behavior is separately chosen.

## 2026-05-14: Create missing output parent directories

### Context

`--out` is a full file path, but its parent directory may not exist yet.

### Decision

V1 creates missing parent directories for the requested output path.

### Rationale

This makes normal usage like `--out exports/photo.jpg` work without another setup step and does not expand the command surface.

### Consequences

The implementation should create the parent directory before suffix collision checks and writing the output.

## 2026-05-14: Add JPEG output extension automatically

### Context

V1 always exports JPEG, but requiring the user to type `.jpg` in `--out` is unnecessary friction.

### Decision

V1 does not require a JPEG extension in `--out`. The command normalizes the final output path to `.jpg` automatically.

### Rationale

The output format is fixed, so the command can keep the file extension consistent without exposing another choice.

### Consequences

The implementation should derive the actual output path with a `.jpg` extension before collision suffixing. The printed output path should include the normalized `.jpg` filename.

## 2026-05-14: Replace provided output extension with jpg

### Context

Automatic JPEG extension handling needed a precise rule for paths that already include a non-JPEG extension.

### Decision

If `--out` includes an extension that is not `.jpg` or `.jpeg`, replace that extension with `.jpg`. For example, `exports/photo.png` becomes `exports/photo.jpg`.

### Rationale

V1 has a fixed JPEG output format. Replacing the extension keeps the final path clean and avoids confusing names like `photo.png.jpg`.

### Consequences

Path normalization should happen before suffixing and before printing the actual written path.

## 2026-05-14: Use dash-number output collision suffixes

### Context

V1 does not overwrite existing outputs. The suffix format needed to be fixed.

### Decision

Use `name-1.jpg`, `name-2.jpg`, and so on for output path collisions.

### Rationale

The format is simple, readable, and common.

### Consequences

After normalizing the requested output path to `.jpg`, check whether it exists. If it does, increment the numeric suffix until an available path is found.

## 2026-07-10: Adopt TypeScript 7 as the project compiler

### Context

TypeScript 7.0.2 is the stable native TypeScript release. The project currently resolves TypeScript 5.9.3 through a `^5` peer dependency even though TypeScript is a private development tool here. TypeScript 7 also defaults `types` to an empty list, so Bun's ambient declarations must be selected explicitly.

### Decision

Install `typescript` `^7.0.2` as a dev dependency and add `types: ["bun"]` to `tsconfig.json`. Do not install the TypeScript 6 compatibility package.

### Rationale

The repository only invokes the `tsc` CLI and does not consume the compiler API. A disposable TypeScript 7.0.2 check passed for the complete project after selecting Bun's types, so the compatibility package would add an unused toolchain path.

### Consequences

`bun install --frozen-lockfile` now installs a reproducible TypeScript 7 compiler. Any future tool that imports the TypeScript compiler API must be evaluated separately because TypeScript 7.0 does not expose that API.

## 2026-07-22: Adopt stable type-aware Oxlint

Formatter details in this decision are superseded by "2026-07-22: Complete the Oxc toolchain with Oxfmt."

### Context

Oxlint 1.75 and `oxlint-tsgolint` 7 provide stable type-aware linting backed by TypeScript Go. The repository already uses TypeScript 7.0.2, which is the exact compiler version targeted by the current `oxlint-tsgolint` 7.0.2001 release. Biome currently performs both formatting and syntax-only linting.

### Decision

Use Oxlint for the package entry point, `src`, and `tests`, enable type-aware linting in the root configuration, and fail the quality gate on every warning. Keep Biome only as the formatter. Keep the independent `tsc --noEmit` quality gate instead of enabling Oxlint's still-experimental `typeCheck` option. Pin Oxlint, TypeScript, and `oxlint-tsgolint` to compatible exact versions.

### Rationale

Type-aware rules catch defects such as floating or misused promises that a syntax-only linter cannot prove. Retaining `tsc` keeps compiler diagnostics on the stable, established path while type-aware linting adds semantic rules without duplicating another TypeScript compiler implementation. Exact compatible versions prevent an independent dependency update from silently changing type-aware diagnostics or pairing `tsgolint` with a different TypeScript release.

### Consequences

`bun run lint` now requires the `oxlint-tsgolint` package and discovers the repository's `tsconfig.json` automatically. TypeScript and `oxlint-tsgolint` must be upgraded together. Biome configuration no longer contains lint rules; formatting behavior is unchanged.

### Verification and lessons

- `bun install --frozen-lockfile` resolves the pinned toolchain without lockfile changes.
- `OXC_LOG=debug bunx oxlint index.ts src tests` confirms that `tsgolint` assigns all ten linted files to the root `tsconfig.json`; no files are unmatched.
- `bun run check` passes typechecking, type-aware linting, 10 unit tests, and 10 FFmpeg integration tests.
- Enabling `typeAware` does not implicitly replace compiler diagnostics. Keep the explicit typecheck until Oxlint's `typeCheck` option is no longer marked experimental.

## 2026-07-22: Complete the Oxc toolchain with Oxfmt

### Context

After adopting type-aware Oxlint, Biome remains only as the repository formatter. Oxfmt 0.60 supports every text format used by this repository and provides a dedicated check mode suitable for the existing quality gate.

### Decision

Remove Biome completely and use pinned Oxfmt 0.60.0 for formatting and format verification. Adopt Oxfmt's 100-character line width with the existing two-space, double-quote, semicolon, and trailing-comma style. Keep import sorting disabled and enable deterministic `package.json` key sorting. Add `format:check` to `bun run check`.

### Rationale

One Oxc-based lint-and-format toolchain removes the remaining duplicate parser dependency. A checked-in configuration makes editor and CI behavior explicit. Import sorting is an independent ordering policy and remains disabled by default, avoiding semantic or high-churn changes unrelated to formatting. The 100-character width is Oxfmt's TypeScript-oriented default and reduces unnecessary wrapping.

### Consequences

`bun run format` writes Oxfmt output and `bun run format:check` performs a non-mutating verification. The complete quality gate now rejects formatting drift. The initial migration must format all supported repository files once; later diffs stay incremental.

### Verification and lessons

- `bun install --frozen-lockfile` resolves the Oxc toolchain without lockfile changes.
- The initial `bun run format` normalized eight files; import order remained unchanged.
- `bun run check` passes TypeScript 7 typechecking, type-aware Oxlint, Oxfmt verification across 29 files, 10 unit tests, and 10 FFmpeg integration tests.
- Oxfmt traverses this repository without Biome's broken-symlink warning for `.cursor/rules`, so no formatter-specific ignore workaround is required.

## 2026-07-22: Expand Oxlint coverage and standardize agent output

### Context

The initial Oxlint setup only loaded its default plugins and two explicit TypeScript rules. The
repository needs broader checks for its Bun/Node runtime, imports, accessibility, promises, and
Vitest tests, while lint diagnostics should use Oxlint's agent-oriented output consistently.

### Decision

Enable the built-in `node`, `import`, `jsx-a11y`, `promise`, and `vitest` plugins in the root
Oxlint configuration. Enforce `import/no-cycle` as an error. Make the package lint command pass
`--format=agent`; all quality-gate linting continues to flow through that command.

### Rationale

A single checked-in plugin policy keeps editor and command-line lint behavior aligned. Explicit
cycle detection protects the small domain-module graph from hidden circular dependencies. The
agent formatter makes diagnostics compact and actionable for the agents that own implementation.

### Consequences

New correctness diagnostics from these plugins and import cycles fail `bun run lint` and therefore
`bun run check`. Direct ad hoc Oxlint invocations must also use `--format=agent` when diagnostics
are intended for consumption.

## 2026-07-25: Deepen the prepare-image workflow and image engine

### Context

The production product remains one `prepare-image` command, but its product rules are currently
spread across the CLI, `prepare_image.ts`, `prepare_image_layout.ts`, `output_path.ts`, and
`media_process.ts`. Directory input added source discovery, ordering, output-directory semantics,
and partial-failure behavior to the CLI instead of the domain workflow. The output-path and media
process modules each have one caller and expose almost as much knowledge as their implementations:
one returns a path before the write is safely reserved, while the other exposes raw FFmpeg and
ffprobe arguments. The exported layout has eleven renderer-facing fields that only the FFmpeg
caller understands.

The deletion test therefore identifies the CLI orchestration, output-path module, raw media-process
module, and external layout representation as shallow. Deleting any of them moves their knowledge
to one caller rather than causing useful behavior to reappear across multiple callers. The
single-image rendering implementation itself remains substantial and should become a deeper
module, not be split into more hypothetical seams.

Directory input also superseded older decisions that described v1 as strictly one input file and
required `--out` to always be a full file path. The live product accepts either one supported image
or one directory of supported top-level images. For directory input, `--out` is an output
directory.

### Decision

Create two deep modules:

- The **Prepare image workflow module** owns supported-source validation, file-versus-directory
  discovery, deterministic batch order, destination semantics, JPEG path normalization, collision
  allocation, staging, commit, rollback, and the final list of written paths. Its interface accepts
  the command's input path, output path, and border value.
- The concrete **Image engine module** owns system-versus-bundled FFmpeg executable selection,
  source inspection and orientation normalization, target/layout computation, white-canvas
  rendering, baseline JPEG encoding, and normalized engine failures. Its interface renders one
  ready-to-upload Instagram image from a supported source into a caller-provided staging path.

The CLI remains the adapter for argv, stdout, stderr, and process exit behavior. Layout math stays
pure inside the image engine implementation, but its renderer-specific execution object is no
longer an external interface. Tests primarily exercise the same command interface users call.
Do not add abstract filesystem, parser, or alternate-image-engine seams: each would currently have
only one adapter.

For a directory input, processing is all-or-nothing from the caller's perspective. Every image is
rendered into a private staging directory first. Final paths are committed with atomic
no-overwrite allocation; if preparation or commit fails, staged files and any outputs committed by
that invocation are removed. Successful output paths retain sorted source order.

Delete the unused package entry point and its `Hello via Bun!` implementation. The private package
has no library interface; its package script is the production entry.

### Rationale

This gives callers leverage through one workflow interface and gives maintainers locality for
source, batch, output-lifecycle, image-engine, and error invariants. It also turns “never overwrite”
from a check-then-write convention into an allocation guarantee and makes batch failure semantics
explicit. Keeping FFmpeg concrete respects the existing engine decision without inventing a
hypothetical adapter seam.

Acceptance tests at the command interface cover the real package script, supported-format policy,
file and directory destinations, deterministic output, rollback, layout effects, metadata,
orientation, and both system and bundled executable adapters. Focused internal examples are only
retained when they protect an invariant that is impractical to observe through rendered output.

### Consequences

This supersedes the earlier decisions that directory orchestration belongs only in the CLI, that
v1 excludes batch preparation, and that `--out` is always a full file path. It also revisits the
earlier decision that the exported layout object is the core test surface: the interface is now the
test surface, while layout remains an internal pure implementation detail.

`CONTEXT.md`, README, AGENTS, scripts, and CI must describe the same current workflow. Completed
slice plans should be removed once their durable decisions are represented here, reducing stale
Markdown surfaces without deleting history from Git.

## 2026-07-25: Make the sRGB output contract explicit and observable

### Context

The Image engine encoded baseline `yuvj420p` JPEGs but did not convert tagged non-sRGB sources or
write observable sRGB evidence. JPEG YCbCr pixel format is not itself proof of sRGB. FFmpeg's
system and bundled `colorspace` filters can convert sources whose color space, primaries, transfer
function, and range are explicitly tagged, but the bundled encoder does not preserve primaries and
transfer metadata in its JPEG stream.

### Decision

Treat untagged v1 sources as sRGB, matching the conventional PNG/JPEG photo workflow. When FFprobe
reports a complete supported color description, convert it inside the Image engine to JPEG-range
BT.601 YCbCr with BT.709 primaries and the IEC 61966-2-1 transfer function. After FFmpeg strips all
source metadata and writes the JPEG, add one generated EXIF ColorSpace tag whose value is `1`
(sRGB). Do not copy any source EXIF/XMP fields.

The generated color marker is product output metadata, not metadata preservation. Tests must prove
both conversion of an explicitly Display-P3-tagged fixture and replacement of source metadata by
the single generated sRGB marker.

### Rationale

This gives the ready-to-upload Instagram image interface an observable sRGB contract while keeping
all color handling local to the concrete Image engine. It avoids claiming that `yuvj420p` alone is
sRGB and does not add a new module or adapter seam.

### Consequences

Sources with complete recognized color tags are transformed. Untagged sources are explicitly
assumed to already contain sRGB pixel values; v1 does not attempt arbitrary ICC-profile parsing.
The exported JPEG contains a minimal generated EXIF segment even though all source EXIF/XMP
metadata remains stripped.

### Verification and lessons

- `bun install --frozen-lockfile` completes without lockfile changes.
- `bun run check` passes TypeScript 7, type-aware Oxlint, Oxfmt, and 22 command/Image engine
  acceptance tests with 87 assertions.
- `bun run prepare-image --help` matches the documented command interface.
- `git diff --check` passes.
- Three independent architecture sweeps found no remaining P0/P1 deepening candidates after the
  workflow, Image engine, output lifecycle, color, test-surface, documentation, and tooling
  changes.
- A requested external Fable review could not start because the configured Claude account had
  reached its monthly spend limit; the implementation did not depend on that unavailable review.
