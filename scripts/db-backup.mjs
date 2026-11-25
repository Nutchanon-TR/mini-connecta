import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const mode = process.argv[2];
const file = resolve(process.argv[3] ?? 'artifacts/mini-connecta.dump');
const container = process.argv[4];
const remote = '/tmp/mini-connecta-' + process.pid + '.dump';
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 90_000 });

if (mode === 'dump') {
  if (existsSync(file)) throw new Error('Choose a new backup filename');
  mkdirSync(dirname(file), { recursive: true });
  const id = docker('compose', 'ps', '-q', 'postgres').trim();
  assert(id, 'Start the Compose database first');
  try {
    docker(
      'exec',
      id,
      'sh',
      '-ec',
      'pg_dump -Fc --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$1"',
      'backup',
      remote,
    );
    docker('cp', id + ':' + remote, file);
  } finally {
    docker('exec', id, 'rm', '-f', remote);
  }
  console.log('Saved ' + file);
} else if (mode === 'restore') {
  assert(existsSync(file), 'Backup file not found');
  assert(
    /^mini-connecta-restore-[a-z0-9-]+$/.test(container ?? ''),
    'Use a separate mini-connecta-restore-* container',
  );
  const id = docker('inspect', '--format', '{{.Id}}', container).trim();
  assert.notEqual(
    id,
    docker('compose', 'ps', '-q', 'postgres').trim(),
    'Restore into a separate database',
  );
  try {
    docker('cp', file, container + ':' + remote);
    docker(
      'exec',
      container,
      'sh',
      '-ec',
      'pg_restore --single-transaction --exit-on-error --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$1"',
      'restore',
      remote,
    );
  } finally {
    docker('exec', container, 'rm', '-f', remote);
  }
  console.log('Restored to ' + container);
} else {
  throw new Error(
    'Usage: node scripts/db-backup.mjs dump FILE | restore FILE mini-connecta-restore-NAME',
  );
}
