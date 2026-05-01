import { accessSync, constants, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { printHelpIfRequested } from "./args";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

const fixturePaths = [
  "tests/fixtures/images/portrait_sample_30x40.ppm",
  "tests/fixtures/images/portrait_sample_30x40.png",
  "tests/fixtures/images/landscape_sample_48x32.jpg",
  "tests/fixtures/images/portrait_video_360x640.mp4",
] as const;
const USAGE = "Usage: bun run doctor [--help]";

function commandCheck(command: string): Check {
  const path = Bun.which(command);
  return {
    name: command,
    ok: path !== null,
    detail: path ?? `${command} not found in PATH`,
  };
}

function fixtureCheck(path: string): Check {
  return {
    name: path,
    ok: existsSync(path),
    detail: existsSync(path) ? "present" : "missing",
  };
}

function writableDirCheck(path: string): Check {
  try {
    accessSync(path, constants.W_OK);
    return { name: path, ok: true, detail: "writable" };
  } catch (error) {
    return { name: path, ok: false, detail: error instanceof Error ? error.message : "not writable" };
  }
}

function tempWriteCheck(): Check {
  const dir = mkdtempSync(join(tmpdir(), "passepartout-doctor-"));
  try {
    writeFileSync(join(dir, "probe.txt"), "ok", "utf8");
    return { name: "temp-dir", ok: true, detail: dir };
  } catch (error) {
    return { name: "temp-dir", ok: false, detail: error instanceof Error ? error.message : "write failed" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runChecks(): Check[] {
  return [
    { name: "bun", ok: Bun.version.length > 0, detail: Bun.version },
    commandCheck("ffmpeg"),
    commandCheck("ffprobe"),
    writableDirCheck("tests/fixtures/exports"),
    tempWriteCheck(),
    ...fixturePaths.map(fixtureCheck),
  ];
}

if (printHelpIfRequested(process.argv.slice(2), USAGE)) {
  process.exit(0);
}

const checks = runChecks();
for (const check of checks) {
  const marker = check.ok ? "ok" : "fail";
  console.log(`${marker} ${check.name}: ${check.detail}`);
}

if (checks.some((check) => !check.ok)) {
  process.exit(1);
}
