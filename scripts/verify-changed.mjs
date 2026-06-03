import { existsSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const lintableExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ignoredSegments = new Set(['.next', 'build', 'node_modules', 'out']);

function run(command, args) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isLintable(path) {
  const normalized = normalize(path);
  if (normalized.split(/[\\/]/).some((segment) => ignoredSegments.has(segment))) {
    return false;
  }

  return lintableExtensions.has(extname(normalized));
}

function unique(values) {
  return [...new Set(values)];
}

const explicitFiles = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
let files = explicitFiles;

if (files.length === 0) {
  const tracked = run('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']);
  const untracked = run('git', ['ls-files', '--others', '--exclude-standard']);

  if (tracked.status !== 0 || untracked.status !== 0) {
    console.error('Unable to read changed files from git.');
    process.exit(1);
  }

  files = [...splitLines(tracked.stdout), ...splitLines(untracked.stdout)];
}

const lintTargets = unique(files)
  .filter(isLintable)
  .filter((file) => existsSync(resolve(file)));

if (lintTargets.length === 0) {
  console.log('No changed lintable JS/TS files found.');
  process.exit(0);
}

console.log(`Running focused ESLint on ${lintTargets.length} changed file(s).`);

const eslintEntry = resolve('node_modules/eslint/bin/eslint.js');
const eslintCommand = existsSync(eslintEntry)
  ? process.execPath
  : process.platform === 'win32'
    ? 'npx.cmd'
    : 'npx';

const eslintArgs = existsSync(eslintEntry)
  ? [eslintEntry, ...lintTargets]
  : ['eslint', ...lintTargets];

const result = spawnSync(eslintCommand, eslintArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
}

process.exit(result.status ?? 1);
