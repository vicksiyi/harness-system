#!/usr/bin/env node
import { cp, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
const target = join(codexHome, "skills");

await mkdir(target, { recursive: true });
for (const name of ["harness", "harness-requirement", "harness-bugfix", "harness-polish", "harness-quality"]) {
  await cp(join(root, "skills", name), join(target, name), { recursive: true, force: true });
  console.log(`Installed ${name} -> ${join(target, name)}`);
}
