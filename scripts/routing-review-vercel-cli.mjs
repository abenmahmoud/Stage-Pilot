import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const PREVIEW_TEAM = "team_iImd3gDqlMkHIJEnx6ZVJXSy";
const PREVIEW_PROJECT = "prj_mgYyTk8e2FwUMW5kSG8176Snypy5";
const VERCEL_CLI_PACKAGE = "vercel@59.10.0";

export function runRoutingReviewVercel(args, { spawnImpl = spawnSync, input } = {}) {
  const npxPath = process.env.npm_execpath
    ? join(dirname(process.env.npm_execpath), "npx-cli.js")
    : join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  if (!existsSync(npxPath)) throw new Error("preview_vercel_cli_unavailable");
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    name.toUpperCase() === "VERCEL_TOKEN"
    || !/KEY|TOKEN|SECRET|PASSWORD|DATABASE|SUPABASE|BREVO|OPENAI|ANTHROPIC|PREVIEW_ROUTING_REVIEW|^PG/iu.test(name)));
  return spawnImpl(process.execPath, [npxPath, "--offline", "--no-install", VERCEL_CLI_PACKAGE, ...args], {
    encoding: "utf8", maxBuffer: 2 * 1024 * 1024, input,
    windowsHide: true, shell: false, timeout: args[0] === "--version" ? 15_000 : 45_000,
    env: { ...env, CI: "1", NO_UPDATE_NOTIFIER: "1", VERCEL_TELEMETRY_DISABLED: "1" },
  });
}

export function assertRoutingReviewVercelAvailable(spawnImpl) {
  const result = runRoutingReviewVercel(["--version"], { spawnImpl });
  if (result.status !== 0 || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(result.stdout.trim())) {
    throw new Error("preview_vercel_cli_unavailable");
  }
}

export function assertRoutingReviewDeployment(deploymentHost, { spawnImpl } = {}) {
  const fail = () => { throw new Error("routing_review_deployment_unverified"); };
  if (typeof deploymentHost !== "string"
    || !/^lyceegest-[a-z0-9]{1,32}-safe-scol\.vercel\.app$/u.test(deploymentHost)) fail();
  let deployment;
  try {
    const result = runRoutingReviewVercel([
      "api", `/v13/deployments/${deploymentHost}`, "--method", "GET", "--raw", "--scope", PREVIEW_TEAM,
    ], { spawnImpl });
    if (result.status !== 0) fail();
    deployment = JSON.parse(result.stdout);
  } catch {
    fail();
  }
  // The raw Vercel API represents the standard preview environment as null.
  if (!deployment || (deployment.target !== null && deployment.target !== "preview")
    || deployment.customEnvironment != null || deployment.readyState !== "READY"
    || deployment.projectId !== PREVIEW_PROJECT || deployment.ownerId !== PREVIEW_TEAM
    || deployment.url !== deploymentHost || deployment.name !== "lyceegest"
    || deployment.meta?.githubCommitRef !== "codex/lycee-connect-prototype"
    || !/^[0-9a-f]{40}$/u.test(deployment.meta?.githubCommitSha ?? "")) fail();
  return { id: deployment.id, commit: deployment.meta.githubCommitSha };
}

export function routingReviewAuthorizationInput(accessToken) {
  if (typeof accessToken !== "string" || accessToken.length > 8192
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(accessToken)) {
    throw new Error("preview_authorization_invalid");
  }
  return `Authorization: Bearer ${accessToken}\n`;
}
