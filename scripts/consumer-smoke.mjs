import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporaryDirectory = await mkdtemp(join(tmpdir(), "seam-bricks-consumer-"));

try {
  const packedOutput = execFileSync(
    "npm",
    ["pack", "--silent", "--json", "--pack-destination", temporaryDirectory],
    { encoding: "utf8", shell: process.platform === "win32" },
  );
  const [{ filename }] = JSON.parse(packedOutput);
  const archive = join(temporaryDirectory, filename);

  await writeFile(
    join(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      archive,
      "react@19.2.8",
      "react-dom@19.2.8",
    ],
    {
      cwd: temporaryDirectory,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );

  await writeFile(
    join(temporaryDirectory, "verify.mjs"),
    `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { SeamBricks, DEFAULT_SEAM_BRICKS_OPTIONS, createSeamBricksPreset } from "@seam-agency/seam-bricks";

      if (DEFAULT_SEAM_BRICKS_OPTIONS.continuous !== false) {
        throw new Error("On-demand rendering must remain the default");
      }
      const html = renderToStaticMarkup(React.createElement(SeamBricks, { label: "Ready" }));
      if (!html.includes("seam-bricks") || !html.includes("Ready")) {
        throw new Error("Consumer render failed");
      }
      const configurable = renderToStaticMarkup(
        React.createElement(SeamBricks, { config: createSeamBricksPreset("trio", "Reusable") }),
      );
      if (!configurable.includes('data-piece-count="3"') || !configurable.includes("Reusable")) {
        throw new Error("Configurable consumer render failed");
      }
    `,
  );
  execFileSync("node", ["verify.mjs"], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });

  const installedPackage = JSON.parse(
    await readFile(
      join(
        temporaryDirectory,
        "node_modules",
        "@seam-agency",
        "seam-bricks",
        "package.json",
      ),
      "utf8",
    ),
  );
  if (installedPackage.name !== "@seam-agency/seam-bricks") {
    throw new Error("Installed package identity mismatch.");
  }

  console.log("Consumer smoke test passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
