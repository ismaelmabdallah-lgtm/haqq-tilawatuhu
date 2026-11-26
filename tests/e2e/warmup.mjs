/**
 * Waits until the Pages emulator serves the freshly built site, and warms the
 * JS/CSS chunks the pages reference: `wrangler pages dev` is slow the first
 * time it serves each asset, which otherwise makes the first browser load of a
 * suite time out.
 */
const PATHS = ["/", "/exams/_/", "/attempts/_/", "/certificates/_/", "/admin/", "/account/", "/levels/"];

async function get(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
  const body = await res.text();
  return { ok: res.ok, body };
}

export async function waitForSite(base, paths = PATHS) {
  const deadline = Date.now() + 120_000;
  const assets = new Set();
  for (const p of paths) {
    for (;;) {
      try {
        const { ok, body } = await get(base + p, 10_000);
        if (ok) { for (const m of body.matchAll(/["'](\/_next\/static\/[^"'?#]+)["']/g)) assets.add(m[1]); break; }
        if (p !== "/" ) break;          // optional pages may not exist in every build
      } catch { /* not ready yet */ }
      if (Date.now() > deadline) throw new Error(`site not ready at ${base}${p}`);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  // Limited concurrency: a burst of dozens of parallel requests crashed the
  // local workerd runtime on Windows.
  const queue = [...assets];
  await Promise.all(Array.from({ length: 3 }, async () => {
    for (let a = queue.shift(); a; a = queue.shift()) await get(base + a, 60_000).catch(() => null);
  }));
}
