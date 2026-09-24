import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await Promise.all([
  build({
    entryPoints: ["src/attendance.js"],
    bundle: true,
    minify: true,
    format: "esm",
    outfile: "assets/attendance.js",
  }),
  build({
    entryPoints: ["src/portal.js"],
    minify: true,
    outfile: "assets/portal.js",
  }),
  build({
    entryPoints: ["styles.css"],
    minify: true,
    outfile: "assets/portal.css",
  }),
]);
// Content versions prevent cached scripts/styles/config from disagreeing with the HTML.
for (const [html, assets] of [
  ["lendet/2026-2027/mobile/syllabus.html", ["assets/portal.js", "assets/portal.css"]],
  [
    "attendance.html",
    ["assets/attendance.js", "assets/attendance.css", "attendance-config.js"],
  ],
]) {
  let text = await readFile(html, "utf8");
  for (const asset of assets) {
    const version = createHash("sha256")
      .update(await readFile(asset))
      .digest("hex")
      .slice(0, 12);
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(
      new RegExp(`((?:src|href)="/?${escaped})(?:\\?v=[^"\\s]+)?"`, "g"),
      `$1?v=${version}"`,
    );
  }
  await writeFile(html, text);
}
console.log("Built browser assets with content versions.");

await import("./build-catalog.mjs");

await import("./build-weekly-guides.mjs");
