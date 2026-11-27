// Usage: npm --workspace server run gen-script -- s1e6
// Generates and caches the Pass 1–2 script for an episode with the script model.
import * as content from "../content";
import { generateScriptJson } from "../claude";
import { generateScript } from "../scriptGen";

const id = process.argv[2] ?? "s1e6";
const ep = content.episode(id);
if (!ep) {
  console.error(`unknown episode ${id}`);
  process.exit(1);
}
const out = await generateScript(ep, content.defaultKnownChunkIds(ep), generateScriptJson);
if (out.problems.length) {
  console.error("Script failed checks (not cached):\n- " + out.problems.join("\n- "));
  process.exit(2);
}
console.log(`Cached ${out.script.lines.length} lines for ${id} in ${content.CACHE_DIR}/scripts/${id}.json — review it before use.`);
