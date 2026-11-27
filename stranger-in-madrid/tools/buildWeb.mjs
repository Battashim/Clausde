// Builds the zero-install web edition: bundles web/src (which reuses shared/ + content/) into one HTML page.
// Usage: node tools/buildWeb.mjs  →  web/dist/stranger-in-madrid.html
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = await build({
  entryPoints: [join(root, "web/src/main.ts")],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  minify: true,
  loader: { ".md": "text" },
  legalComments: "none",
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = readFileSync(join(root, "web/template.html"), "utf8").replace("/*APP_JS*/", () => js);
mkdirSync(join(root, "web/dist"), { recursive: true });
writeFileSync(join(root, "web/dist/stranger-in-madrid.html"), html);
console.log(`web/dist/stranger-in-madrid.html  ${(html.length / 1024).toFixed(0)} KB`);
