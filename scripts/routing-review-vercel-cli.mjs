import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

export function runRoutingReviewVercel(args, { spawnImpl = spawnSync, input } = {}) {
  const npxPath = process.env.npm_execpath
    ? join(dirname(process.env.npm_execpath), "npx-cli.js")
    : join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  if (!existsSync(npxPath)) throw new Error("preview_vercel_cli_unavailable");
  return spawnImpl(process.execPath, [npxPath, "--offline", "--no-install", "vercel", ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, input,
    windowsHide: true, shell: false, timeout: args[0] === "--version" ? 15_000 : 45_000,
    env: { ...process.env, CI: "1", NO_UPDATE_NOTIFIER: "1", VERCEL_TELEMETRY_DISABLED: "1" },
  });
}

export function assertRoutingReviewVercelAvailable(spawnImpl) {
  const result = runRoutingReviewVercel(["--version"], { spawnImpl });
  if (result.status !== 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(result.stdout.trim())) {
    throw new Error("preview_vercel_cli_unavailable");
  }
}

export function routingReviewAuthorizationInput(accessToken) {
  if (typeof accessToken !== "string" || accessToken.length > 8192
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(accessToken)) {
    throw new Error("preview_authorization_invalid");
  }
  return `Authorization: Bearer ${accessToken}\n`;
}
