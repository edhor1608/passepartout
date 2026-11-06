import { expect, test } from "bun:test";
import { DEFAULT_PREPARE_IMAGE_BORDER_PX } from "../src/domain/prepare_image";
import {
  computePrepareImageLayout,
  type PrepareImageLayout,
} from "../src/domain/prepare_image_layout";

// The iOS app ports computePrepareImageLayout to Swift. This test owns the shared fixture the
// Swift port is checked against. Regenerate after a deliberate layout change:
//   UPDATE_LAYOUT_PARITY=1 bun test tests/layout_parity.test.ts
const FIXTURE_URL = new URL(
  "../ios/PassepartoutKit/Tests/PassepartoutKitTests/Resources/layout-parity.json",
  import.meta.url,
);

type LayoutInput = { sourceWidth: number; sourceHeight: number; borderPx: number };
type ParityCase =
  | { input: LayoutInput; layout: PrepareImageLayout }
  | { input: LayoutInput; error: "sourceTooSmall" | "invalidInput" };

test("Swift layout parity fixture matches the TypeScript layout", async () => {
  const expected = renderFixture(buildInputs().map(toParityCase));
  if (process.env.UPDATE_LAYOUT_PARITY === "1") {
    await Bun.write(FIXTURE_URL, expected);
  }
  expect(await Bun.file(FIXTURE_URL).text()).toBe(expected);
});

function buildInputs(): LayoutInput[] {
  const inputs: LayoutInput[] = [];
  const add = (sourceWidth: number, sourceHeight: number, borderPx: number): void => {
    inputs.push({ borderPx, sourceHeight, sourceWidth });
  };
  const borders = [0, 1, DEFAULT_PREPARE_IMAGE_BORDER_PX, 165];

  // The golden cases of prepare_image_layout.test.ts.
  for (const [width, height, border] of GOLDEN_CASES) add(width, height, border);

  // Shrink regime: every size up to 40x40 at the production border.
  for (let width = 1; width <= 40; width += 1) {
    for (let height = 1; height <= 40; height += 1)
      add(width, height, DEFAULT_PREPARE_IMAGE_BORDER_PX);
  }

  // Variant and ratio boundaries at +-1 px around sizes where the layout changes behaviour.
  for (const base of [100, 1000, 1326, 1440, 2046, 4000]) {
    for (const border of borders) {
      for (const [ratioWidth, ratioHeight] of BOUNDARY_RATIOS) {
        for (const delta of [-1, 0, 1]) {
          add(Math.round((base * ratioWidth) / ratioHeight) + delta, base, border);
        }
      }
    }
  }

  // Camera sizes, both orientations.
  for (const [width, height] of CAMERA_SIZES) {
    for (const border of borders) {
      add(width, height, border);
      add(height, width, border);
    }
  }

  // Log-uniform sizes from a fixed LCG, so the set is identical on every runtime.
  const random = createLcg(0x2545f491);
  for (let index = 0; index < 1000; index += 1) {
    const size = (): number => Math.max(1, Math.round(Math.exp(random() * Math.log(20_000))));
    const border = [0, DEFAULT_PREPARE_IMAGE_BORDER_PX, 165, Math.floor(random() * 400)][
      Math.floor(random() * 4)
    ];
    add(size(), size(), border ?? DEFAULT_PREPARE_IMAGE_BORDER_PX);
  }

  // Invalid inputs, so the error contract is shared too.
  add(0, 100, DEFAULT_PREPARE_IMAGE_BORDER_PX);
  add(100, 0, DEFAULT_PREPARE_IMAGE_BORDER_PX);
  add(100, 100, -1);
  return inputs;
}

const GOLDEN_CASES = [
  [6494, 4330, 165],
  [1440, 1920, 165],
  [1000, 600, 165],
  [914, 554, 165],
  [1000, 1000, 165],
  [6494, 4330, 0],
] as const;

const BOUNDARY_RATIOS = [
  [1, 1],
  [3, 2],
  [2, 3],
  [4, 3],
  [3, 4],
] as const;

const CAMERA_SIZES = [
  [4032, 3024],
  [5712, 4284],
  [8064, 6048],
  [4032, 2268],
  [3024, 3024],
  [6000, 4000],
  [6240, 4160],
  [7952, 5304],
  [16_000, 3000],
  [1080, 1350],
] as const;

function createLcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) >>> 0;
    return state / 2 ** 32;
  };
}

function toParityCase(input: LayoutInput): ParityCase {
  try {
    return { input, layout: computePrepareImageLayout(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message.includes("too small") ? "sourceTooSmall" : "invalidInput", input };
  }
}

/** One case per line, so a layout change shows up as a reviewable per-case diff. */
function renderFixture(cases: ParityCase[]): string {
  const lines = cases.map((parityCase) => `    ${JSON.stringify(parityCase)}`).join(",\n");
  return `{\n  "defaultBorderPx": ${DEFAULT_PREPARE_IMAGE_BORDER_PX},\n  "cases": [\n${lines}\n  ]\n}\n`;
}
