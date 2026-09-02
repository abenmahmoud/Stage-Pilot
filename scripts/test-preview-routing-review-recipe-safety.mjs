import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertRoutingReviewDeployment, assertRoutingReviewVercelAvailable, routingReviewAuthorizationInput, runRoutingReviewVercel } from "./routing-review-vercel-cli.mjs";
import { closeRoutingReviewFixtureSession } from "./routing-review-session-cleanup.mjs";

const [source, publicClient] = await Promise.all([
  readFile(new URL("./test-preview-support-assistant-routing-review.mjs", import.meta.url), "utf8"),
  readFile(new URL("./test-preview-routing-review-client.mjs", import.meta.url), "utf8"),
]);

assert.match(source, /CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE/);
assert.match(source, /assertRoutingReviewPreviewTarget\(\{/);
assert.ok(source.indexOf("assertRoutingReviewPreviewTarget({") < source.indexOf("const admin = createClient("));
assert.ok(source.indexOf("assertRoutingReviewVercelAvailable();") < source.indexOf("const admin = createClient("));
assert.match(source, /SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED/);
assert.match(source, /Vercel redacted secret placeholders are refused/);
assert.match(source, /supabaseUrl, expectedRef, productionRef, deploymentHost/);
assert.match(source, /@example\.test/);
assert.match(source, /support_requests/);
assert.match(source, /support_assistant_routing_reviews/);
assert.doesNotMatch(source, /pgmq|support_jobs|BREVO/i);
assert.match(source, /auth\.mfa\.enroll/);
assert.match(source, /currentLevel, "aal2"/);
assert.match(source, /routingDecision: "confirmed"/);
assert.match(source, /assignedTeam: "secretariat"/);
assert.match(source, /routingReview\?\.status, "confirmed"/);
assert.match(source, /routingReview\?\.status, "corrected"/);
assert.match(source, /await deleteRequestFixtures\(\)/);
assert.match(source, /institution_memberships[\s\S]+\.delete\(\)/);
assert.match(source, /admin\.auth\.admin\.deleteUser/);
assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*(?:accessToken|password|email|public_code)/);
assert.doesNotMatch(publicClient, /SUPABASE_SERVICE_ROLE_KEY|auth\.admin|(?:admin|client)\.from\(/);
assert.match(publicClient, /CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE/);
assert.match(publicClient, /assertRoutingReviewPreviewTarget\(\{/);
assert.ok(publicClient.indexOf("assertRoutingReviewPreviewTarget({") < publicClient.indexOf("const client = createClient("));
assert.ok(publicClient.indexOf("assertRoutingReviewVercelAvailable();") < publicClient.indexOf("const client = createClient("));
assert.match(publicClient, /currentLevel, "aal2"/);
assert.match(publicClient, /routingDecision: "confirmed"/);
assert.match(publicClient, /assignedTeam: "secretariat"/);
assert.match(publicClient, /cleanup: "external_required"/);
assert.match(publicClient, /await closeRoutingReviewFixtureSession\(client, createdFactorId\)/);
assert.match(publicClient, /error\?\.code === "ENOENT" && !process\.env\.PREVIEW_ENV_FILE/);
assert.doesNotMatch(publicClient, /console\.(?:log|error)\([^\n]*(?:accessToken|password|email|confirmCode|correctCode)/);
for (const script of [source, publicClient]) {
  assert.doesNotMatch(script, /Authorization: Bearer/);
  assert.match(script, /"--header",\s+"@-"/);
  assert.match(script, /input: routingReviewAuthorizationInput\(accessToken\)/);
  assert.ok(script.lastIndexOf("} finally {") < script.lastIndexOf("if (!process.exitCode) {"));
  assert.ok(script.indexOf("assertRoutingReviewDeployment(deploymentHost);") < script.indexOf("= createClient("));
  assert.doesNotMatch(script, /throw (?:created|signIn|enrollment)\.error/);
}

console.log("preview routing review static safety checks passed");

test("both recipes reject misleading Supabase destinations before any network request", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lyceegest-routing-recipe-"));
  const envFile = join(directory, "empty.env");
  const preview = "xijocumlwivhbmffrnlj";
  const production = "sfqhxiamhgsbbogluqtq";
  const base = { ...process.env, PREVIEW_ENV_FILE: envFile,
    NEXT_PUBLIC_SUPABASE_URL: `https://${preview}.supabase.co`,
    VITE_SUPABASE_URL: `https://${preview}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon-key", VITE_SUPABASE_ANON_KEY: "synthetic-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key", EXPECTED_SUPABASE_REF: preview,
    PRODUCTION_SUPABASE_REF: production, CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE: preview,
    SUPPORT_ASSISTANT_ROUTING_REVIEW_ENABLED: "true",
    PREVIEW_ROUTING_REVIEW_DEPLOYMENT: "lyceegest-123abc456-safe-scol.vercel.app",
    PREVIEW_ROUTING_REVIEW_FIXTURE_EMAIL: "codex-routing-review-synthetic@example.test",
    PREVIEW_ROUTING_REVIEW_FIXTURE_PASSWORD: "synthetic-password-for-local-tests",
    PREVIEW_ROUTING_REVIEW_CONFIRM_CODE: "BC-2099-000001",
    PREVIEW_ROUTING_REVIEW_CORRECT_CODE: "BC-2099-000002" };
  const targets = [
    { NEXT_PUBLIC_SUPABASE_URL: `https://${preview}.attacker.invalid` },
    { NEXT_PUBLIC_SUPABASE_URL: `http://${preview}.supabase.co` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${preview}.supabase.co:8443` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${preview}.supabase.co?private=synthetic-private-marker` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://synthetic-private-marker@${preview}.supabase.co` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${production}.supabase.co`, EXPECTED_SUPABASE_REF: production,
      PRODUCTION_SUPABASE_REF: "", CONFIRM_PREVIEW_ROUTING_REVIEW_RECIPE: production },
    { PRODUCTION_SUPABASE_REF: "" },
    { EXPECTED_SUPABASE_REF: "" },
    { PREVIEW_ROUTING_REVIEW_DEPLOYMENT: "lyceegest-git-codex-lycee-connect-prototype-safe-scol.vercel.app" },
    { PREVIEW_ROUTING_REVIEW_DEPLOYMENT: "lyceegest.vercel.app" },
  ];
  try {
    await writeFile(envFile, "# Empty synthetic recipe environment\n", { flag: "wx" });
    for (const name of ["test-preview-support-assistant-routing-review.mjs", "test-preview-routing-review-client.mjs"]) {
      const program = `import childProcess from 'node:child_process';
        import { syncBuiltinESMExports } from 'node:module';
        childProcess.spawnSync = (_, args) => {
          if (process.env.RECIPE_CLI_UNAVAILABLE === 'true') return { status: 1, stdout: '', stderr: '' };
          if (args.includes('--version')) return { status: 0, stdout: '59.10.0', stderr: '' };
          if (!args.includes('api') || !args.includes('GET')) throw new Error('unexpected_cli_mutation');
          return { status: 0, stdout: JSON.stringify({
            id: 'dpl_synthetic', name: 'lyceegest', url: process.env.PREVIEW_ROUTING_REVIEW_DEPLOYMENT,
            target: process.env.RECIPE_PRODUCTION_METADATA === 'true' ? 'production' : null,
            readyState: 'READY', projectId: 'prj_mgYyTk8e2FwUMW5kSG8176Snypy5',
            ownerId: 'team_iImd3gDqlMkHIJEnx6ZVJXSy',
            meta: { githubCommitRef: 'codex/lycee-connect-prototype', githubCommitSha: 'a'.repeat(40) },
          }), stderr: '' };
        };
        syncBuiltinESMExports();
        globalThis.fetch = () => {
          if (process.env.RECIPE_EMPTY_SIGNIN === 'true') return Promise.resolve(new Response('{}', {
            status: 200, headers: { 'Content-Type': 'application/json' },
          }));
          console.error('unexpected_network_attempt'); process.exit(86);
        };
        await import(${JSON.stringify(new URL(name, import.meta.url).href)});`;
      const run = (changes, cwd = new URL("../", import.meta.url)) => spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
        cwd, env: { ...base, ...changes },
        encoding: "utf8", windowsHide: true, timeout: 5000,
      });
      // The local guard intercepts even the valid case; no real service is contacted.
      assert.equal(run({}).status, 86, `${name}: valid configuration reaches only the injected guard`);
      assert.equal(run({ PREVIEW_ENV_FILE: undefined }, directory).status, 86, `${name}: exported variables do not require a default env file`);
      const unavailable = run({ RECIPE_CLI_UNAVAILABLE: "true" });
      assert.equal(unavailable.status, 1);
      assert.match(unavailable.stderr, /preview_vercel_cli_unavailable/);
      assert.doesNotMatch(unavailable.stdout + unavailable.stderr, /unexpected_network_attempt/);
      const production = run({ RECIPE_PRODUCTION_METADATA: "true" });
      assert.equal(production.status, 1);
      assert.match(production.stderr, /routing_review_deployment_unverified/);
      assert.doesNotMatch(production.stdout + production.stderr, /unexpected_network_attempt/);
      if (name === "test-preview-routing-review-client.mjs") {
        const emptySignIn = run({ RECIPE_EMPTY_SIGNIN: "true" });
        assert.equal(emptySignIn.status, 1);
        assert.match(emptySignIn.stderr, /preview_sign_in_failed/);
        assert.doesNotMatch(emptySignIn.stdout, /"metrics":"verified"/);
      }
      for (const target of targets) {
        const result = run(target);
        assert.equal(result.status, 1, `${name}: invalid destination rejected before fetch`);
        assert.match(result.stderr, /routing_review_preview_target_invalid/);
        assert.doesNotMatch(result.stdout + result.stderr, /unexpected_network_attempt|synthetic-private-marker|synthetic-service-key/);
      }
    }
  } finally {
    try {
      await unlink(envFile);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    } finally {
      await rmdir(directory);
    }
  }
});

test("requires trusted Vercel metadata before a recipe can use a deployment", () => {
  const host = "lyceegest-123abc456-safe-scol.vercel.app";
  const valid = { id: "dpl_synthetic", name: "lyceegest", url: host, target: null,
    readyState: "READY", projectId: "prj_mgYyTk8e2FwUMW5kSG8176Snypy5",
    ownerId: "team_iImd3gDqlMkHIJEnx6ZVJXSy",
    meta: { githubCommitRef: "codex/lycee-connect-prototype", githubCommitSha: "a".repeat(40) } };
  const run = (metadata) => assertRoutingReviewDeployment(host, { spawnImpl: (_, args) => {
    assert.deepEqual(args.slice(4), ["api", `/v13/deployments/${host}`, "--method", "GET", "--raw", "--scope", valid.ownerId]);
    return { status: 0, stdout: JSON.stringify(metadata) };
  } });
  assert.equal(run(valid).commit, valid.meta.githubCommitSha);
  assert.equal(run({ ...valid, target: "preview" }).commit, valid.meta.githubCommitSha);
  for (const candidate of [null, [], {}, { ...valid, target: "production" },
    { ...valid, target: undefined }, { ...valid, target: "staging" },
    { ...valid, customEnvironment: { slug: "custom" } }, { ...valid, readyState: "BUILDING" },
    { ...valid, projectId: "prj_other" }, { ...valid, ownerId: "team_other" },
    { ...valid, name: "other" }, { ...valid, url: "other.vercel.app" },
    { ...valid, meta: { ...valid.meta, githubCommitRef: "main" } },
    { ...valid, meta: { ...valid.meta, githubCommitSha: "short" } }]) {
    assert.throws(() => run(candidate), { message: "routing_review_deployment_unverified" });
  }
  for (const result of [{ status: 1, stdout: "private-provider-detail" },
    { status: null, stdout: "", error: { code: "ETIMEDOUT" } }, { status: 0, stdout: "invalid-json" }]) {
    assert.throws(() => assertRoutingReviewDeployment(host, { spawnImpl: () => result }),
      { message: "routing_review_deployment_unverified" });
  }
  assert.throws(() => assertRoutingReviewDeployment("https://untrusted.invalid", {
    spawnImpl: () => assert.fail("Invalid host must not reach a process"),
  }), { message: "routing_review_deployment_unverified" });
});

test("does not pass application credentials to the CLI", () => {
  const names = ["SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "BREVO_API_KEY", "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY", "SUPPORT_ACCESS_SECRET", "PREVIEW_ROUTING_REVIEW_FIXTURE_PASSWORD",
    "PGPASSWORD", "supabase_service_role_key", "VERCEL_TOKEN"];
  const original = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = "synthetic-private-marker";
    runRoutingReviewVercel(["--version"], { spawnImpl: (_, __, options) => {
      for (const name of names.filter((name) => name !== "VERCEL_TOKEN")) assert.equal(options.env[name], undefined);
      assert.equal(options.env.VERCEL_TOKEN, "synthetic-private-marker");
      const pathEntry = Object.entries(options.env).find(([name]) => name.toUpperCase() === "PATH");
      assert.equal(pathEntry?.[1], process.env.PATH);
      return { status: 0, stdout: "59.10.0" };
    } });
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("runs the cached CLI through Node without a Windows shell or automatic installation", () => {
  const calls = [];
  const spawnImpl = (executable, args, options) => {
    calls.push({ executable, args, options });
    return { status: 0, stdout: "59.10.0\n", stderr: "" };
  };
  assertRoutingReviewVercelAvailable(spawnImpl);
  const args = ["curl", "/api/support/agent/metrics?days=7", "--deployment", "lyceegest-123abc456-safe-scol.vercel.app"];
  const input = routingReviewAuthorizationInput("synthetic.header.signature");
  runRoutingReviewVercel(args, { spawnImpl, input });
  for (const call of calls) {
    assert.equal(call.executable, process.execPath);
    assert.match(call.args[0], /[\\/]npm[\\/]bin[\\/]npx-cli\.js$/u);
    assert.deepEqual(call.args.slice(1, 4), ["--offline", "--no-install", "vercel@59.10.0"]);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.windowsHide, true);
    assert.equal(call.options.env.CI, "1");
  }
  assert.deepEqual(calls[1].args.slice(4), args);
  assert.equal(calls[1].options.input, "Authorization: Bearer synthetic.header.signature\n");
  assert.doesNotMatch(JSON.stringify(calls[1].args), /Bearer|synthetic\.header\.signature/);
  assert.equal(calls[0].options.timeout, 15000);
  assert.equal(calls[1].options.timeout, 45000);
  for (const result of [{ status: 1, stdout: "private-provider-detail" },
    { status: null, stdout: "", error: { code: "ETIMEDOUT" } }, { status: 0, stdout: "not a CLI version" }]) {
    assert.throws(() => assertRoutingReviewVercelAvailable(() => result), { message: "preview_vercel_cli_unavailable" });
  }
});

test("rejects malformed authorization before constructing a curl input", () => {
  for (const token of [null, undefined, "", "token", "a.b.c\r\nX-Other: injected", "a.b.c\n", "a.b.c\0", "a".repeat(8193)]) {
    assert.throws(() => routingReviewAuthorizationInput(token), { message: "preview_authorization_invalid" });
  }
});

test("removes only the fixture factor and signs out even when one cleanup step fails", async () => {
  for (const factorId of [null, "synthetic-factor"]) {
    for (const failure of [null, "unenroll_error", "unenroll_throw", "signout_error", "signout_throw"]) {
      const calls = [];
      const client = { auth: {
        mfa: { unenroll: async (args) => {
          calls.push({ step: "unenroll", args });
          if (failure === "unenroll_throw") throw new Error("private-provider-detail");
          return { error: failure === "unenroll_error" ? new Error("private-provider-detail") : null };
        } },
        signOut: async (args) => {
          calls.push({ step: "signout", args });
          if (failure === "signout_throw") throw new Error("private-provider-detail");
          return { error: failure === "signout_error" ? new Error("private-provider-detail") : null };
        },
      } };
      const expected = !failure || (!factorId && failure.startsWith("unenroll"));
      assert.equal(await closeRoutingReviewFixtureSession(client, factorId), expected);
      assert.deepEqual(calls, [
        ...(factorId ? [{ step: "unenroll", args: { factorId } }] : []),
        { step: "signout", args: { scope: "local" } },
      ]);
    }
  }
});
