#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const MODE = process.env.TRANSLATION_AGENT_MODE || 'check';
const ALLOWED_PAIRS = [
  {
    source: 'README.md',
    target: 'README.de.md',
    title: 'README.de.md',
  },
  {
    source: 'docs/DEVELOPMENT_WORKFLOW.md',
    target: 'docs/DEVELOPMENT_WORKFLOW.de.md',
    title: 'docs/DEVELOPMENT_WORKFLOW.de.md',
  },
];

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function markerFor(sourcePath, hash) {
  return `<!-- translation-source: ${sourcePath} -->\n<!-- translation-source-sha256: ${hash} -->`;
}

function readText(path) {
  if (!existsSync(path)) {
    throw new Error(`Required file is missing: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

function stripOldMarker(content) {
  return content
    .replace(/^<!-- translation-source: .*? -->\n<!-- translation-source-sha256: .*? -->\n\n?/u, '')
    .replace(/^> \[!WARNING\]\n> TODO translation review: .*?\n\n/usu, '');
}

let hasChanges = false;
let hasStaleTranslations = false;

for (const pair of ALLOWED_PAIRS) {
  const sourceContent = readText(pair.source);
  const targetContent = readText(pair.target);
  const sourceHash = sha256(sourceContent);
  const expectedMarker = markerFor(pair.source, sourceHash);
  const hasExpectedMarker = targetContent.includes(expectedMarker);
  const isPlaceholder = /Platzhalterdatei|placeholder/iu.test(targetContent);

  if (isPlaceholder) {
    console.error(`${pair.target} still looks like a placeholder.`);
    hasStaleTranslations = true;
  }

  if (!hasExpectedMarker) {
    hasStaleTranslations = true;

    if (MODE === 'prepare-pr') {
      const body = stripOldMarker(targetContent).trimStart();
      const nextContent = `${expectedMarker}\n\n> [!WARNING]\n> TODO translation review: The English source changed or the source marker was missing. Review this German translation before merging.\n\n${body}`;
      writeFileSync(pair.target, nextContent, 'utf8');
      hasChanges = true;
      console.log(`Updated translation marker for ${pair.target}.`);
    } else {
      console.error(`${pair.target} is missing the current source marker for ${pair.source}.`);
    }
  } else {
    console.log(`${pair.target} is linked to current ${pair.source}.`);
  }
}

if (MODE !== 'check' && MODE !== 'prepare-pr') {
  throw new Error(`Unsupported TRANSLATION_AGENT_MODE: ${MODE}`);
}

if (MODE === 'check' && hasStaleTranslations) {
  process.exitCode = 1;
}

if (MODE === 'prepare-pr') {
  console.log(hasChanges ? 'Translation files updated for review.' : 'No translation marker changes needed.');
}
