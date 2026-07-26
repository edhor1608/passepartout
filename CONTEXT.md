# Context

## Glossary

### Ready-to-upload Instagram image

A single highest-quality baseline sRGB JPEG output prepared from one user-provided source image so it can be uploaded manually through the Instagram app without additional resizing or padding. V1 source images are PNG, JPEG, or TIFF. For v1, this excludes scheduler/API upload compatibility, video, benchmarking, matrix validation, and experimental research workflows. Directory preparation can produce multiple ready-to-upload Instagram images without changing the contract of each output.

### Metadata preservation

V1 strips source EXIF/XMP metadata from the exported JPEG. It adds only a generated EXIF ColorSpace tag identifying the output as sRGB; source GPS/device/time/orientation metadata is not copied.

### EXIF orientation

V1 respects source EXIF orientation visually before stripping metadata. The exported JPEG should have correctly oriented pixels without relying on EXIF orientation metadata.

### Prepare image

The single v1 user-facing command/workflow: a supported source file or directory in, ready-to-upload JPEG output or outputs out. It accepts one positional input, required `--out`, and optional `--border-px`. For file input, `--out` is a full file path. For directory input, `--out` is an output directory. Internal source discovery, analysis, layout, staging, and rendering are implementation details, not separate v1 product commands.

### Directory preparation

When Prepare image receives a directory, it processes supported top-level files in sorted filename order and ignores unsupported files and nested directories. It stages every output before publishing any of them. A failed directory preparation leaves no output from that invocation; a successful run prints one final path per source in source order.

### Image engine

V1 uses FFmpeg for source decoding, orientation/color handling, scaling/compositing, and JPEG export. Completely and recognizably tagged non-sRGB sources are converted to sRGB characteristics; untagged photo sources are treated as already containing sRGB pixel values.

### Help output

`prepare-image --help` shows a one-line usage string and only the v1 options: `--out` and `--border-px`.

### Output path suffixing

V1 never overwrites an existing output file. It atomically commits to the first available path after `.jpg` normalization: `photo.jpg`, `photo-1.jpg`, `photo-2.jpg`, and so on. This also disambiguates directory inputs whose source files share the same basename.

### Output extension normalization

V1 always writes a JPEG file. The user does not need to provide a `.jpg` or `.jpeg` extension in `--out`; the command normalizes the final output path to `.jpg` automatically. If the user provides another extension, replace it, so `exports/photo.png` becomes `exports/photo.jpg`.

### Output parent directories

If the parent directory of the requested output file path does not exist, v1 creates it automatically.

### Command output

The v1 command prints every actual written output path on success. A path may differ from the requested or derived output path when suffixing is applied. Normal behavior, including metadata stripping, should not print warnings.

### Command errors

V1 command failures print a concise error to stderr and exit non-zero.

### V1 target canvas

The maximum v1 output targets for manual Instagram app upload are `2160x1440` for landscape and `1440x1920` for portrait, exported in sRGB. Exports should not exceed these target sizes.

### V1 output shape set

The v1 product has exactly two output shape ratios: landscape `3:2` up to `2160x1440` and portrait `3:4` up to `1440x1920`. Small no-upscale exports should use integer dimensions that preserve the target ratio where possible: landscape dimensions are multiples of `3x2`, portrait dimensions are multiples of `3x4`.

### Variant auto-detection

By default, v1 chooses the output shape from the input image dimensions after applying EXIF orientation: wider-than-tall images use the landscape target, and all other images use the portrait target. Square images use the portrait target.

### White canvas

A solid white background used for every v1 output. Portrait images are attached without cropping; landscape images may use a centered crop to preserve their equal outer border. The result creates a polaroid-ish look and a visually consistent Instagram profile grid. This is the canonical term for what a user may call a white border.

### Transparency handling

Transparent pixels in the source image are composited onto white in v1 output.

### Minimum white border

The smallest allowed white margin around the fitted source image at full target size, defined as one non-negative integer pixel value. The v1 default is `57px`. `0px` is valid. If the output must shrink to avoid upscaling, the border scales down by the same factor. Effective scaled borders are rounded to the nearest integer pixel, with a minimum of `1px` when the configured border is greater than `0`; configured `0px` stays `0px`. Landscape uses the scaled value as the exact equal outer border. Portrait uses it as the minimum border.

### No upscaling

V1 never enlarges source pixels. If the source image is too small for the maximum target canvas, export a smaller canvas with the same target ratio and proportionally equivalent white borders.

### Equal outer border

For landscape v1 outputs, the white border should be visually equal on all four sides by default. If the source image ratio does not fit the inner frame created by the equal border, the image may be cropped slightly inside the frame using a centered crop. This is acceptable because the even outer border is part of the desired look.

### Portrait variant

A v1 output path for source images that should be posted as a vertical Instagram feed image. Portrait outputs use contain fit: preserve the full source image, center it on the fixed portrait canvas, and keep at least the minimum white border.

### Landscape variant

A v1 output path for source images that should preserve a horizontal composition as a real landscape Instagram image with white padding/border when needed. It should not bake landscape photos into a portrait canvas for v1; Instagram's profile-grid preview can be handled by Instagram's own setting.
