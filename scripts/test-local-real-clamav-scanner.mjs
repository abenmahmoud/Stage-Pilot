import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  createCommunicationInboundScanner,
} from "../workers/communication-inbound-scanner.mjs";

const IMAGE_DIGEST = "sha256:f0954d679017eb6d48221e2b2be3ac5457bf278a844f39b672376f55a085f591";
const IMAGE = `clamav/clamav@${IMAGE_DIGEST}`;
const CONTAINER = `lyceegest-clamav-recipe-${process.pid}`;
const DOCKER = process.env.LYCEEGEST_DOCKER_EXE
  ?? "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const PREFIX = "lyceegest-inbound-scan-";
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

if (!process.argv.includes("--local-container-only")) {
  throw new Error("local_container_confirmation_required");
}
if (!isAbsolute(DOCKER)
  || !["docker", "docker.exe"].includes(basename(DOCKER).toLowerCase())
  || !existsSync(DOCKER)) throw new Error("docker_cli_missing");

const dockerEnvironment = Object.fromEntries([
  "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOMEDRIVE",
  "HOMEPATH", "APPDATA", "LOCALAPPDATA",
].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : []));

function docker(args, { input } = {}) {
  return spawnSync(DOCKER, args, {
    encoding: "utf8",
    input,
    maxBuffer: 64 * 1024,
    windowsHide: true,
    env: dockerEnvironment,
  });
}

function expectDocker(result, code) {
  if (result.error || result.status !== 0 || result.signal) throw new Error(code);
  return result.stdout.trim();
}

function scanInput(bytes) {
  return {
    bytes,
    confirmation: {
      institutionId: "00000000-0000-4000-8000-000000009301",
      inboundId: "00000000-0000-4000-8000-000000009310",
      objectId: "00000000-0000-4000-8000-000000009320",
      mediaType: "text/plain",
      sizeBytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

const tempEntries = () => new Set(readdirSync(tmpdir()).filter((name) => name.startsWith(PREFIX)));
const before = tempEntries();
let created = false;

try {
  const digest = expectDocker(
    docker(["image", "inspect", IMAGE, "--format", "{{index .RepoDigests 0}}"]),
    "pinned_clamav_image_missing",
  );
  assert.match(digest, new RegExp(`${IMAGE_DIGEST.replaceAll(".", "\\.")}$`));

  expectDocker(docker([
    "run", "-d", "--rm", "--name", CONTAINER, "--network", "none",
    "--memory", "3g", "--cpus", "2", IMAGE,
  ]), "clamav_container_start_failed");
  created = true;

  let health = "";
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const state = docker(["inspect", CONTAINER, "--format", "{{.State.Health.Status}}"]);
    if (state.status === 0) health = state.stdout.trim();
    if (health === "healthy") break;
    if (health === "unhealthy") throw new Error("clamav_container_unhealthy");
  }
  assert.equal(health, "healthy", "clamav_container_not_ready");

  const hostConfig = JSON.parse(expectDocker(
    docker(["inspect", CONTAINER, "--format", "{{json .HostConfig}}"]),
    "clamav_container_isolation_unavailable",
  ));
  assert.equal(hostConfig.NetworkMode, "none");
  assert.deepEqual(hostConfig.PortBindings ?? {}, {});

  const version = expectDocker(
    docker(["exec", CONTAINER, "clamdscan", "--version"]),
    "clamav_version_unavailable",
  );
  assert.match(version, /^ClamAV 1\.5\./u);

  const scan = createCommunicationInboundScanner({
    executable: DOCKER,
    endpoint: { port: 3310 },
    timeoutMs: 60_000,
    concurrency: 1,
    spawnImpl(executable, args, options) {
      assert.equal(executable, DOCKER);
      assert.deepEqual(args.filter((_, index) => index !== 1), [
        "--config-file", "--stream", "--no-summary", "-",
      ]);
      assert.equal(
        readFileSync(args[1], "utf8"),
        "TCPAddr 127.0.0.1\nTCPSocket 3310\nStreamMaxLength 10485761\n",
      );
      return spawn(executable, [
        "exec", "-i", CONTAINER, "clamdscan", "--stream", "--no-summary", "-",
      ], {
        ...options,
        env: { ...dockerEnvironment, LANG: "C", LC_ALL: "C" },
      });
    },
  });

  const clean = await scan(scanInput(Buffer.from("Document fictif sans donnee personnelle")));
  assert.equal(clean.status, "clean");
  assert.equal(clean.scanDetail, "clamav_clean");
  assert.ok(Number.isFinite(Date.parse(clean.scannedAt)));

  const blocked = await scan(scanInput(Buffer.from(EICAR)));
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.scanDetail, "antivirus_detected_threat");
  assert.ok(Number.isFinite(Date.parse(blocked.scannedAt)));

  const after = tempEntries();
  assert.deepEqual([...after].filter((name) => !before.has(name)), []);

  console.log(JSON.stringify({
    engine: version,
    imageDigest: IMAGE_DIGEST,
    network: "none",
    publishedPorts: 0,
    clean: clean.status,
    eicar: blocked.status,
    temporaryResidues: 0,
  }));
} finally {
  if (created) docker(["rm", "-f", CONTAINER]);
  const remaining = docker(["ps", "-a", "--filter", `name=^/${CONTAINER}$`, "--format", "{{.ID}}"]);
  assert.equal(remaining.status, 0, "clamav_cleanup_check_failed");
  assert.equal(remaining.stdout.trim(), "", "clamav_container_residue");
}
