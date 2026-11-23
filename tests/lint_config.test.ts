import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dir, "..");

const CANARIES = {
  "import/no-cycle": {
    "a.ts": 'import { b } from "./b";\nexport const a = (): number => b() + 1;\n',
    "b.ts": 'import { a } from "./a";\nexport const b = (): number => a() - 1;\n',
  },
  "typescript/no-explicit-any": {
    "canary.ts": "export const value: any = 1;\n",
  },
  "typescript/no-misused-promises": {
    "canary.ts": "[1].forEach(async () => {\n  await Promise.resolve();\n});\n",
  },
  "typescript/no-non-null-assertion": {
    "canary.ts": "export const first = [1].find((value) => value === 1)!;\n",
  },
  "typescript/strict-boolean-expressions": {
    "canary.ts":
      "export function count(text: string | undefined): number {\n  return text ? 1 : 0;\n}\n",
  },
} satisfies Record<string, Record<string, string>>;

type OxlintConfig = { rules: Record<string, "off" | "warn" | "error"> };
type OxlintReport = { diagnostics: { code: string; filename: string }[] };

async function readOxlintConfig(): Promise<OxlintConfig> {
  return Bun.JSONC.parse(await Bun.file(join(REPO_ROOT, ".oxlintrc.json")).text()) as OxlintConfig;
}

test("every configured lint rule has a canary", async () => {
  const { rules } = await readOxlintConfig();
  expect(Object.keys(CANARIES).sort()).toEqual(Object.keys(rules).sort());
});

test("every configured lint rule reports its canary", () => {
  const canaryRoot = mkdtempSync(join(REPO_ROOT, "tests", ".lint-canaries-"));
  try {
    for (const [rule, files] of Object.entries(CANARIES)) {
      const ruleDir = join(canaryRoot, rule.replace("/", "-"));
      mkdirSync(ruleDir);
      for (const [name, source] of Object.entries(files)) {
        writeFileSync(join(ruleDir, name), source);
      }
    }

    const proc = Bun.spawnSync({
      cmd: [join(REPO_ROOT, "node_modules", ".bin", "oxlint"), "--format=json", canaryRoot],
      cwd: REPO_ROOT,
      stderr: "pipe",
      stdout: "pipe",
    });
    const report = JSON.parse(proc.stdout.toString()) as OxlintReport;

    const silentRules = Object.keys(CANARIES)
      .filter((rule) => {
        const [plugin, name] = rule.split("/");
        const ruleDir = rule.replace("/", "-");
        return !report.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === `${plugin}(${name})` && diagnostic.filename.includes(ruleDir),
        );
      })
      .map(
        (rule) =>
          `${rule} reported nothing on its canary. Fix .oxlintrc.json: "plugins" must list "${rule.split("/")[0]}" (an explicit list replaces oxlint's defaults), and type-aware rules need "typeAware": true.`,
      );
    expect(silentRules).toEqual([]);
  } finally {
    rmSync(canaryRoot, { force: true, recursive: true });
  }
});
