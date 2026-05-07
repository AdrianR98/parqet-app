#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const BUILD = 1;
const SKIP = 0;

const SAFE_EXACT_FILES = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "README.md",
  "README.de.md",
]);

const SAFE_PREFIXES = [
  "docs/",
  "prompts/",
  ".github/ISSUE_TEMPLATE/",
];

const ALWAYS_BUILD_EXACT_FILES = new Set([
  ".env.example",
  "eslint.config.mjs",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "postcss.config.js",
  "postcss.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "tsconfig.json",
  "yarn.lock",
]);

const ALWAYS_BUILD_PREFIXES = [
  ".github/workflows/",
  "app/",
  "components/",
  "lib/",
  "public/",
  "scripts/",
  "src/",
];

function log(message) {
  console.log(`[vercel-ignore-build] ${message}`);
}

function getChangedFiles() {
  try {
    const output = execFileSync("git", ["diff", "--name-only", "HEAD^", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    log("Could not determine changed files with `git diff HEAD^ HEAD`.");
    log("Failing open: Vercel should build.");
    if (error instanceof Error && error.message) {
      log(error.message);
    }
    process.exit(BUILD);
  }
}

function startsWithAny(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

function isSafeToSkip(file) {
  return SAFE_EXACT_FILES.has(file) || startsWithAny(file, SAFE_PREFIXES);
}

function mustBuild(file) {
  return ALWAYS_BUILD_EXACT_FILES.has(file) || startsWithAny(file, ALWAYS_BUILD_PREFIXES);
}

const changedFiles = getChangedFiles();

if (changedFiles.length === 0) {
  log("No changed files detected.");
  log("Failing open: Vercel should build.");
  process.exit(BUILD);
}

log(`Changed files: ${changedFiles.join(", ")}`);

const buildReasons = [];
const unknownFiles = [];

for (const file of changedFiles) {
  if (mustBuild(file)) {
    buildReasons.push(file);
    continue;
  }

  if (!isSafeToSkip(file)) {
    unknownFiles.push(file);
  }
}

if (buildReasons.length > 0) {
  log(`Build required because app-relevant or deployment-sensitive files changed: ${buildReasons.join(", ")}`);
  process.exit(BUILD);
}

if (unknownFiles.length > 0) {
  log(`Build required because unknown files changed: ${unknownFiles.join(", ")}`);
  process.exit(BUILD);
}

log("Only documentation/governance files changed. Skipping Vercel build.");
process.exit(SKIP);
