import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeCandidate } from "./candidate-artifact.mjs";

const script = fileURLToPath(new URL("./verify-delivery.mjs", import.meta.url));

test("manual recovery emits the literal true required to retain its promotion artifact", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "papertrail-manual-promotion-"),
  );
  try {
    const identity = {
      sha: "a".repeat(40),
      tree: "b".repeat(40),
      runId: "38523515478",
      headSha: "a".repeat(40),
      channel: "staging",
      basePath: "/papertrail-reader/staging/",
      publish: false,
    };
    const incoming = path.join(directory, "incoming/staging");
    await mkdir(incoming, { recursive: true });
    await writeFile(path.join(incoming, "index.html"), "validated candidate");
    await writeCandidate(incoming, identity);
    const output = path.join(directory, "output");
    const run = async (manualRun, expected) => {
      await writeFile(
        path.join(directory, "promotion-plan.json"),
        JSON.stringify({ ...identity, manualRun }),
      );
      await writeFile(output, "");
      execFileSync(process.execPath, [script], {
        cwd: directory,
        env: {
          ...process.env,
          BASE_PATH: "/papertrail-reader/",
          GITHUB_OUTPUT: output,
        },
      });
      assert.equal(await readFile(output, "utf8"), `publish=${expected}\n`);
      assert.deepEqual(
        JSON.parse(
          await readFile(path.join(directory, "verified-build.json"), "utf8"),
        ).files,
        JSON.parse(await readFile(path.join(incoming, "build.json"), "utf8"))
          .files,
      );
    };
    await run(undefined, false);
    await run("38523515478", true);
    await run(38523515478, true);
    await run("", false);
    await writeFile(path.join(incoming, "index.html"), "tampered");
    await assert.rejects(run("38523515478", true), /checksum mismatch/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
