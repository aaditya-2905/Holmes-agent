// Writes .gz siblings for text assets so nginx serves them with gzip_static (no per-request CPU).
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, constants } from "node:zlib";

const root = new URL("../dist", import.meta.url).pathname;
const exts = /\.(js|css|html|svg|json|txt|webmanifest)$/;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (exts.test(name)) {
      const src = readFileSync(p);
      if (src.length < 1024) continue;
      writeFileSync(`${p}.gz`, gzipSync(src, { level: constants.Z_BEST_COMPRESSION }));
    }
  }
}
walk(root);
