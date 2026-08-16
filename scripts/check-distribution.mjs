import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const required = [
  "dist/index.js",
  "dist/index.d.ts",
  "dist/styles.css",
  "licenses/Geist-OFL-1.1.txt",
];

for (const path of required) {
  await stat(new URL(path, root));
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }

  return files;
}

const outputDirectories = [fileURLToPath(new URL("dist/", root))];
const outputFiles = (
  await Promise.all(outputDirectories.map((directory) => listFiles(directory)))
).flat();

const maps = outputFiles.filter((path) => path.endsWith(".map"));
if (maps.length > 0) {
  throw new Error(`Source maps are not publishable:\n${maps.join("\n")}`);
}

const libraryEntry = new URL("dist/index.js", root);
const librarySize = (await stat(libraryEntry)).size;
if (librarySize > 160_000) {
  throw new Error(`Library entry exceeds 160 kB: ${librarySize} bytes`);
}

const libraryCode = await readFile(libraryEntry, "utf8");
if (!/from\s*["']three["']/.test(libraryCode)) {
  throw new Error("Three.js must remain external to the library bundle.");
}
if (libraryCode.includes("nucleo-pixel")) {
  throw new Error("Development-only icon code must not enter the library bundle.");
}

const libraryStyles = await readFile(new URL("dist/styles.css", root), "utf8");
if (!libraryStyles.includes("Geist Pixel Square")) {
  throw new Error("Published styles must include the Geist Pixel font face.");
}

const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (packageJson.publishConfig?.registry !== "https://npm.pkg.github.com") {
  throw new Error("publishConfig.registry must remain pinned to GitHub Packages.");
}

const relativeOutputs = outputFiles.map((path) =>
  relative(rootPath, path),
);
console.log(
  `Distribution OK: ${relativeOutputs.length} output files, ${librarySize} byte library entry.`,
);
