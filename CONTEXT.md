# Context

## Glossary

### Original

A user-owned PNG, JPEG, or TIFF photo that Passepartout reads without modifying. Avoid: source image, input image.

### Export

A highest-quality baseline sRGB JPEG produced from an original for manual upload through the Instagram app without additional resizing or padding. Avoid: output image, ready-to-upload Instagram image.

### Metadata preservation

V1 strips original EXIF/XMP metadata from the export by default, while still exporting sRGB. Color correctness is part of the export; GPS/device/time metadata is not.

### EXIF orientation

V1 respects an original's EXIF orientation visually before stripping metadata. The export should have correctly oriented pixels without relying on EXIF orientation metadata.

### Preparation run

One invocation of the v1 `prepare-image` command. It accepts one original or one input directory, required `--out` file path or output directory, and optional `--border-px`; internal analysis and layout are not separate product commands.

### Batch

A preparation run that processes the supported top-level originals in one input directory in filename order and writes one export per original.

### Image engine

V1 uses FFmpeg for original decoding, orientation/color handling, scaling/compositing, and JPEG export.

### Help output

`prepare-image --help` shows a one-line usage string and only the v1 options: `--out` and `--border-px`.

### Output path suffixing

V1 does not overwrite an existing output file by default. If the requested output path already exists after `.jpg` normalization, the command writes to the first available suffixed path: `photo-1.jpg`, `photo-2.jpg`, and so on.

### Output extension normalization

V1 always writes a JPEG file. The user does not need to provide a `.jpg` or `.jpeg` extension in `--out`; the command normalizes the final output path to `.jpg` automatically. If the user provides another extension, replace it, so `exports/photo.png` becomes `exports/photo.jpg`.

### Output parent directories

If the parent directory of the requested output file path does not exist, v1 creates it automatically.

### Command output

The v1 command always prints the actual written output path on success. This may differ from the requested `--out` path when suffixing is applied. Normal behavior, including metadata stripping, should not print warnings.

### Command errors

V1 command failures print a concise error to stderr and exit non-zero.

### V1 target canvas

The maximum v1 export targets for manual Instagram app upload are `2160x1440` for landscape and `1440x1920` for portrait, exported in sRGB. Exports should not exceed these target sizes.

### V1 output shape set

The v1 product has exactly two output shape ratios: landscape `3:2` up to `2160x1440` and portrait `3:4` up to `1440x1920`. Small no-upscale exports should use integer dimensions that preserve the target ratio where possible: landscape dimensions are multiples of `3x2`, portrait dimensions are multiples of `3x4`.

### Variant auto-detection

By default, v1 chooses the export shape from the original's dimensions after applying EXIF orientation: wider-than-tall originals use the landscape target, and all others use the portrait target. Square originals use the portrait target.

### White canvas

A solid white background used for every v1 export. The original is attached to this canvas, creating a polaroid-ish look and a visually consistent Instagram profile grid. This is the canonical term for what a user may call a white border.

### Transparency handling

Transparent pixels in the original are composited onto white in the export.

### Minimum white border

The smallest allowed white margin around the fitted original at full target size, defined as one non-negative integer pixel value. The v1 default is `57px`; `0px` is valid. If the export must shrink to avoid upscaling, the border scales down by the same factor, for example `57px` becomes about `29px` at `50%` output size. Effective scaled borders are rounded to the nearest integer pixel, with a minimum of `1px` when the configured border is greater than `0`; configured `0px` stays `0px`. Landscape uses the scaled value as the exact equal outer border. Portrait uses it as the minimum border.

### No upscaling

V1 never enlarges original pixels. If the original is too small for the maximum target canvas, export a smaller canvas with the same target ratio and proportionally equivalent white borders.

### Equal outer border

For landscape v1 exports, the white border should be visually equal on all four sides by default. If the original's ratio does not fit the inner frame created by the equal border, the original may be cropped slightly inside the frame using a centered crop. This is acceptable because the even outer border is part of the desired look.

### Portrait variant

A v1 export path for originals that should be posted as vertical Instagram feed images. Portrait exports use contain fit: preserve the full original, center it on the fixed portrait canvas, and keep at least the minimum white border.

### Landscape variant

A v1 export path for originals that should preserve a horizontal composition as a real landscape Instagram image with white padding/border when needed. It should not bake landscape photos into a portrait canvas for v1; Instagram's profile-grid preview can be handled by Instagram's own setting.
