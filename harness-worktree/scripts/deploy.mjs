#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

const steps = [
  ["docker", ["compose", "config"]],
  ["pnpm", ["health"]]
];

let ok = true;
for (const [command, args] of steps) {
  const result = await run(command, args);
  ok = ok && result.code === 0;
  await appendFile(
    join(root, "docs", "test-log.md"),
    `\n## Deploy Check\n\n- At: ${new Date().toISOString()}\n- Command: ${command} ${args.join(" ")}\n- Exit: ${result.code}\n- Output: ${(result.output || "no output").slice(0, 1200).replace(/\n/g, " | ")}\n`
  );
}

process.exit(ok ? 0 : 1);

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("exit", (code) => resolveRun({ code: code ?? 1, output }));
  });
}

