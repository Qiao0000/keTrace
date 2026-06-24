import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const force = process.argv.includes("--force") || process.env.FORCE_BUILD_NATIVE === "1";

// ── Shared directories ──────────────────────────────────────────────

const outDir = resolve("out/native");
mkdirSync(outDir, { recursive: true });

// ── 1. Swift helper (DoubleCtrlMonitor executable) — fallback ───────

if (process.platform === "darwin") {
  const swiftSource = resolve("native/macos/DoubleCtrlMonitor.swift");
  const swiftOutput = join(outDir, "DoubleCtrlMonitor");
  const identifier = "com.ketrace.DoubleCtrlMonitor";

  if (existsSync(swiftSource)) {
    const needRebuild = force || !existsSync(swiftOutput) ||
      statSync(swiftSource).mtimeMs > statSync(swiftOutput).mtimeMs;

    if (needRebuild) {
      execFileSync("swiftc", [swiftSource, "-o", swiftOutput], { stdio: "inherit" });
      try {
        execFileSync("codesign", ["--force", "--sign", "-", "--identifier", identifier,
          "--options=runtime", swiftOutput], { stdio: "inherit" });
      } catch (err) {
        console.warn("codesign failed for Swift helper (non-fatal)");
      }
      console.log("built Swift helper");
    }
  }
}

// ── 2. N-API addon (in-process CGEventTap) — primary mechanism ──────

if (process.platform === "darwin") {
  const addonDir = resolve("native/addon");
  const addonSource = join(addonDir, "ctrl_monitor.mm");
  const gypFile = join(addonDir, "binding.gyp");
  const addonOutput = join(outDir, "ctrl_monitor.node");

  if (existsSync(gypFile) && existsSync(addonSource)) {
    const needRebuild = force || !existsSync(addonOutput) ||
      statSync(addonSource).mtimeMs > statSync(addonOutput).mtimeMs ||
      statSync(gypFile).mtimeMs > statSync(addonOutput).mtimeMs;

    if (needRebuild) {
      // Prefer the unpacked Electron runtime version. package.json can drift when
      // package managers reuse an older dist directory without reinstalling.
      let electronVersion = "";
      try {
        electronVersion = readFileSync(resolve("node_modules/electron/dist/version"), "utf8").trim();
      } catch { /* ignore */ }
      if (!electronVersion) {
        try {
          const ep = JSON.parse(readFileSync(resolve("node_modules/electron/package.json"), "utf8"));
          electronVersion = ep.version;
        } catch { /* ignore */ }
      }

      if (!electronVersion) {
        console.warn("could not determine electron version, skipping addon build");
      } else {
        const nodeGyp = resolve("node_modules/.bin/node-gyp");

        // Clean stale build dir to avoid configure cache issues
        const buildDir = join(addonDir, "build");
        if (existsSync(buildDir)) {
          try { rmSync(buildDir, { recursive: true, force: true }); } catch { /* ignore */ }
        }

        // Use equals-sign format for robustness across node-gyp versions
        execFileSync(
          process.execPath,
          [
            nodeGyp,
            "rebuild",
            `--target=${electronVersion}`,
            "--arch=arm64",
            "--dist-url=https://electronjs.org/headers",
          ],
          { cwd: addonDir, stdio: "inherit" },
        );

        // Copy built .node to out/native/
        const buildOutput = join(addonDir, "build/Release/ctrl_monitor.node");
        if (existsSync(buildOutput)) {
          copyFileSync(buildOutput, addonOutput);
        } else {
          console.error("addon build succeeded but output not found at", buildOutput);
          process.exit(1);
        }
        console.log("built + copied N-API addon");
      }
    } else {
      console.log("N-API addon up-to-date");
    }
  }
}

console.log("build-native done");
