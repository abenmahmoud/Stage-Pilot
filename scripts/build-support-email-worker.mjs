import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const directory = resolve(".vercel/support-email-worker-release");
const file = resolve(directory, "support-email-worker.mjs");
mkdirSync(directory, { recursive: true });
await build({ entryPoints: ["workers/support-email-worker.mjs"], outfile: file,
  bundle: true, platform: "node", format: "esm", target: "node20", external: ["postgres"] });
const manifest = { commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), node: ">=20", external: ["postgres"] };
writeFileSync(resolve(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ directory, ...manifest }));
