import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const requiredFlag = "--local-container-only";
const cliVersion = "2.116.0";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

if (!process.argv.includes(requiredFlag)) {
  throw new Error("local_container_confirmation_required");
}

const localEnvironment = { ...process.env };
for (const name of [
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "POSTGRES_URL",
]) {
  delete localEnvironment[name];
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    env: localEnvironment,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`local_migration_command_failed:${command}:${result.status}`);
  }
};

run("docker", ["version", "--format", "{{.Server.Version}}"]);

const supabase = (...args) => run(npx, [
  "--yes",
  `supabase@${cliVersion}`,
  ...args,
]);

supabase(
  "db",
  "reset",
  "--local",
  "--no-seed",
  "--version",
  "20260518073508",
);
supabase(
  "db",
  "query",
  "--local",
  "--file",
  "scripts/fixtures/production-shape-synthetic.sql",
);
supabase("migration", "up", "--local");
supabase(
  "db",
  "query",
  "--local",
  "--file",
  "scripts/fixtures/production-shape-assertions.sql",
);

console.log(JSON.stringify({
  target: "local_synthetic_production_shape",
  cliVersion,
  migrations: 93,
  classes: 44,
  staff: 106,
  students: 1159,
  placements: 1159,
  realData: false,
}));
