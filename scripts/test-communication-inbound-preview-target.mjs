import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import postgres from "postgres";
import { communicationInboundPreviewDatabaseUrl as validate, COMMUNICATION_INBOUND_PREVIEW_PROJECT as ref }
  from "../workers/communication-inbound-preview-target.mjs";

const direct = `postgresql://postgres:synthetic-password@db.${ref}.supabase.co/postgres`;
const foreign = `postgresql://postgres:${ref}@db.foreign.invalid/postgres`;

test("accepts only the pinned preview database and fixes an omitted port", () => {
  assert.equal(new URL(validate(direct)).port, "5432");
  for (const port of [5432, 6543]) {
    const value = `postgres://postgres.${ref}:synthetic-password@aws-0-eu-west-3.pooler.supabase.com:${port}/postgres`;
    assert.equal(validate(value), value);
  }
});

test("rejects references hidden in passwords, paths, queries or foreign pooler users", () => {
  for (const value of [undefined, "", foreign,
    `postgres://postgres:synthetic-password@localhost/${ref}`,
    `postgres://postgres:synthetic-password@foreign.invalid/postgres?name=${ref}`,
    `postgres://postgres.other:synthetic-password@aws-0-eu-west-3.pooler.supabase.com/postgres?name=${ref}`,
    `postgres://postgres.${ref}:synthetic-password@foreign.pooler.supabase.com.evil.invalid/postgres`,
    direct + "?sslmode=disable", direct + "?options=-csearch_path=foreign", direct + "#fragment",
    direct.replace(/\/postgres$/u, "/other"), direct.replace("postgresql:", "https:"),
    direct.replace("@db.", "@db.\n"), direct.replace(/\/postgres$/u, ":1234/postgres"),
    direct.replace("postgres:synthetic-password", "%:synthetic-password"),
    direct.replace(":synthetic-password", ""), direct.replace(`db.${ref}`, `db.${ref}.other`),
    "x".repeat(4097),
  ]) assert.throws(() => validate(value), (error) => {
    assert.equal(error.message, "inbound_scan_preview_configuration_invalid");
    assert.doesNotMatch(error.stack, /synthetic-password|foreign\.invalid/);
    return true;
  });
});

test("the real Postgres client interprets the validated destination without using a network connection", async () => {
  const prior = process.env.PGPORT;
  process.env.PGPORT = "1234";
  let client;
  try {
    client = postgres(validate(direct), { ssl: { rejectUnauthorized: true }, prepare: false });
    assert.deepEqual(client.options.host, [`db.${ref}.supabase.co`]);
    assert.deepEqual(client.options.port, [5432]);
    assert.equal(client.options.database, "postgres");
    assert.equal(client.options.ssl.rejectUnauthorized, true);
  } finally {
    await client?.end({ timeout: 1 });
    if (prior === undefined) delete process.env.PGPORT; else process.env.PGPORT = prior;
  }
});

test("both executable recipes refuse a misleading destination before opening a database client", () => {
  for (const script of ["test-preview-communication-inbound-replay.mjs", "test-preview-communication-inbound-ingestion.mjs"]) {
    const source = readFileSync(new URL(`./${script}`, import.meta.url), "utf8");
    assert.ok(source.indexOf("communicationInboundPreviewDatabaseUrl(process.env.DATABASE_URL)") < source.indexOf("const client = postgres("));
    assert.match(source, /ssl: \{ rejectUnauthorized: true \}/);
    assert.ok(/finally \{[\s\S]*?await client.end/u.test(source), "recipe closes its dedicated client");
    assert.doesNotMatch(source, /import\("\.\.\/db\/index/);
    for (const value of [foreign, direct + "?sslmode=disable"]) {
      const run = spawnSync(process.execPath, ["--import", "./scripts/ts-test-resolver.mjs",
        "--experimental-strip-types", `scripts/${script}`, "--preview-only"], {
        cwd: new URL("../", import.meta.url), encoding: "utf8", windowsHide: true, timeout: 5000,
        env: { ...process.env, DATABASE_URL: value },
      });
      assert.equal(run.status, 1);
      assert.match(run.stderr, /inbound_scan_preview_configuration_invalid/);
      assert.doesNotMatch(run.stdout + run.stderr, /synthetic-password|ENOTFOUND|ECONNREFUSED/);
    }
  }
});
