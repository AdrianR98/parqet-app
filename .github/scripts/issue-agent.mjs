#!/usr/bin/env node

const OWNER = process.env.GITHUB_REPOSITORY_OWNER;
const REPOSITORY = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const ISSUE_NUMBER = Number.parseInt(process.env.ISSUE_AGENT_ISSUE_NUMBER || '', 10);
const MODE = process.env.ISSUE_AGENT_MODE || 'dry-run';
const API_BASE = 'https://api.github.com';
const MARKER = '<!-- issue-agent:v1 -->';

const LABELS = {
  phase: { color: '5319e7', description: 'Phase or parent planning work' },
  feature: { color: '0e8a16', description: 'Product feature work' },
  bug: { color: 'd73a4a', description: 'Bug or defect' },
  'tech-debt': { color: 'fbca04', description: 'Technical debt' },
  documentation: { color: '0075ca', description: 'Documentation work' },
  governance: { color: '5319e7', description: 'Workflow, rules, process or repository governance' },
  agent: { color: '1d76db', description: 'Agent workflow or agent behavior' },
  ci: { color: '0052cc', description: 'CI, GitHub Actions or deployment checks' },
  architecture: { color: 'c5def5', description: 'Architecture or ADR-related work' },
  security: { color: 'b60205', description: 'Security, secrets or privacy-sensitive work' },
  data: { color: 'f9d0c4', description: 'Data model or data pipeline work' },
  ui: { color: 'c2e0c6', description: 'User interface work' },
  'needs-decision': { color: 'd4c5f9', description: 'Needs a human decision before work continues' },
  'ready-for-codex': { color: '0e8a16', description: 'Ready for a bounded Codex task' },
  blocked: { color: 'b60205', description: 'Blocked by an unresolved dependency or decision' },
};

const STANDARD_SECTIONS = [
  'Summary',
  'Goal',
  'Context',
  'Acceptance Criteria',
  'Non-goals',
  'Verification / Review Plan',
  'Risks',
  'Links / Related issues',
];

function requireEnv() {
  if (!REPOSITORY || !OWNER || !TOKEN) {
    throw new Error('Missing required GitHub Actions environment.');
  }

  if (!Number.isInteger(ISSUE_NUMBER) || ISSUE_NUMBER <= 0) {
    throw new Error('ISSUE_AGENT_ISSUE_NUMBER must be a positive integer.');
  }

  if (MODE !== 'dry-run' && MODE !== 'apply') {
    throw new Error('ISSUE_AGENT_MODE must be dry-run or apply.');
  }
}

function log(message) {
  console.log(`[issue-agent] ${message}`);
}

async function github(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = body?.message || response.statusText;
    throw new Error(`GitHub API ${response.status} ${path}: ${message}`);
  }

  return body;
}

function hasHeading(body, heading) {
  const pattern = new RegExp(`^#{1,3}\\s+${escapeRegex(heading)}\\s*$`, 'imu');
  return pattern.test(body || '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeBody(body) {
  return body || '';
}

function isTemplateLike(issue) {
  const body = normalizeBody(issue.body);
  const requiredMatches = ['Summary', 'Goal', 'Acceptance Criteria'].filter((section) => hasHeading(body, section));
  return requiredMatches.length >= 2 || /P0\.?\d|Phase|Acceptance Criteria|Non-goals/iu.test(`${issue.title}\n${body}`);
}

function classify(issue) {
  const text = `${issue.title}\n${issue.body || ''}`.toLowerCase();
  const labels = new Set();

  if (/phase|p0\.?|p1|parent-issue|parent issue/.test(text)) labels.add('phase');
  if (/bug|error|failure|fix|broken|fehl(er|geschlagen)/.test(text)) labels.add('bug');
  if (/doc|readme|changelog|translation|übersetzung|uebersetzung|markdown/.test(text)) labels.add('documentation');
  if (/governance|workflow|codex|review|merge|issue lifecycle|branch protection|rules/.test(text)) labels.add('governance');
  if (/agent|translation-agent|issue-agent|docs-agent|review-agent/.test(text)) labels.add('agent');
  if (/ci|github actions|workflow|vercel|build|lint|deployment|deploy/.test(text)) labels.add('ci');
  if (/architecture|adr|pipeline|data model|boundary/.test(text)) labels.add('architecture');
  if (/security|secret|token|oauth|privacy|private|\.env/.test(text)) labels.add('security');
  if (/data|parqet api|activity|asset|portfolio|pipeline/.test(text)) labels.add('data');
  if (/ui|ux|dashboard|component|style|layout/.test(text)) labels.add('ui');
  if (/blocked|blocker|waiting|depends on/.test(text)) labels.add('blocked');
  if (/decision|unclear|needs decision|frage|klären|klaeren/.test(text)) labels.add('needs-decision');

  const hasAcceptanceCriteria = /acceptance criteria|akzeptanzkriterien/i.test(text);
  const hasNonGoals = /non-goals|nicht-ziel|nicht ziel/i.test(text);
  const hasScope = /scope|allowed changes|goal|ziel/i.test(text);

  if (hasAcceptanceCriteria && hasNonGoals && hasScope && !labels.has('needs-decision') && !labels.has('blocked')) {
    labels.add('ready-for-codex');
  }

  if (labels.size === 0) {
    labels.add('needs-decision');
  }

  return [...labels].filter((label) => Object.hasOwn(LABELS, label));
}

function missingSections(issue) {
  if (!isTemplateLike(issue)) {
    return [];
  }

  const body = normalizeBody(issue.body);
  return STANDARD_SECTIONS.filter((section) => !hasHeading(body, section));
}

function appendMissingSections(issue, sections) {
  if (sections.length === 0) {
    return issue.body || '';
  }

  const additions = sections.map((section) => {
    if (section === 'Acceptance Criteria') {
      return `## ${section}\n\n- [ ] TODO`;
    }
    return `## ${section}\n\nTODO`;
  });

  const base = normalizeBody(issue.body).trimEnd();
  return `${base}\n\n${MARKER}\n\n${additions.join('\n\n')}`;
}

async function ensureLabel(label) {
  const config = LABELS[label];
  const encoded = encodeURIComponent(label);

  try {
    await github(`/repos/${REPOSITORY}/labels/${encoded}`);
  } catch (error) {
    if (!String(error.message).includes('404')) {
      throw error;
    }

    log(`Creating missing allowlisted label: ${label}`);
    await github(`/repos/${REPOSITORY}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: label, color: config.color, description: config.description }),
    });
  }
}

async function addLabels(issueNumber, labels) {
  if (labels.length === 0) return;

  for (const label of labels) {
    await ensureLabel(label);
  }

  await github(`/repos/${REPOSITORY}/issues/${issueNumber}/labels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  });
}

async function updateIssueBody(issueNumber, body) {
  await github(`/repos/${REPOSITORY}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

function commentBody({ issue, labels, sections, changedBody }) {
  const lines = [
    MARKER,
    '## Issue-Agent v1 summary',
    '',
    `Mode: \`${MODE}\``,
    `Issue: #${issue.number}`,
    '',
    'Proposed / applied labels:',
    labels.length ? labels.map((label) => `- \`${label}\``).join('\n') : '- none',
    '',
    'Missing standard sections:',
    sections.length ? sections.map((section) => `- ${section}`).join('\n') : '- none',
    '',
    `Body update: ${changedBody ? 'yes' : 'no'}`,
    '',
    'Limits: no issue closing, no PR creation, no Project fields, no native Parent/Sub-Issue changes.',
  ];

  return lines.join('\n');
}

async function upsertComment(issueNumber, body) {
  const comments = await github(`/repos/${REPOSITORY}/issues/${issueNumber}/comments?per_page=100`);
  const existing = comments.find((comment) => comment.body?.includes(MARKER) && comment.body?.includes('Issue-Agent v1 summary'));

  if (existing) {
    await github(`/repos/${REPOSITORY}/issues/comments/${existing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    });
    return;
  }

  await github(`/repos/${REPOSITORY}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

async function main() {
  requireEnv();
  log(`Running in ${MODE} mode for issue #${ISSUE_NUMBER}.`);

  const issue = await github(`/repos/${REPOSITORY}/issues/${ISSUE_NUMBER}`);

  if (issue.pull_request) {
    throw new Error('Target is a pull request, not an issue. Issue-Agent v1 only handles issues.');
  }

  const labels = classify(issue);
  const sections = missingSections(issue);
  const existingLabels = new Set((issue.labels || []).map((label) => label.name));
  const labelsToAdd = labels.filter((label) => !existingLabels.has(label));
  const nextBody = appendMissingSections(issue, sections);
  const changedBody = nextBody !== normalizeBody(issue.body);

  log(`Title: ${issue.title}`);
  log(`Labels to add: ${labelsToAdd.length ? labelsToAdd.join(', ') : 'none'}`);
  log(`Missing sections: ${sections.length ? sections.join(', ') : 'none'}`);
  log(`Body update needed: ${changedBody ? 'yes' : 'no'}`);

  if (MODE === 'dry-run') {
    log('Dry run complete. No changes were made.');
    return;
  }

  await addLabels(issue.number, labelsToAdd);

  if (changedBody) {
    await updateIssueBody(issue.number, nextBody);
  }

  await upsertComment(issue.number, commentBody({ issue, labels, sections, changedBody }));
  log('Apply complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
