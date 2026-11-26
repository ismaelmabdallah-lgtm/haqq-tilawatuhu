#!/usr/bin/env node
/**
 * Works around a Next 16 static-export bug on WINDOWS builds only.
 *
 * The client router requests segment prefetch files with flat names such as
 * /levels/__next.levels.__PAGE__.txt (convertSegmentPathToStaticExportFilename
 * replaces "/" with "."). On Windows the exporter collects segment paths with
 * "\" separators, so they are not flattened and land in nested directories
 * (out/levels/__next.levels/__PAGE__.txt) — every prefetch then 404s.
 *
 * This moves any such nested file to its flat name. On Linux (Cloudflare Pages
 * builds) the export is already flat and this script changes nothing.
 */
import { readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const out = join(process.cwd(), "out");
let moved = 0;

function flatten(dir, prefix, targetDir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) flatten(p, `${prefix}.${name}`, targetDir);
    else { renameSync(p, join(targetDir, `${prefix}.${name}`)); moved++; }
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name.startsWith("__next.")) { flatten(p, name, dir); rmSync(p, { recursive: true, force: true }); }
    else walk(p);
  }
}

walk(out);
console.log(moved ? `[postbuild] flattened ${moved} segment prefetch file(s) (Windows export workaround)` : "[postbuild] segment files already flat");
