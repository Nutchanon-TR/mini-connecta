import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const count = Number(process.argv[2] ?? 5);
const duration = process.argv[3] ?? '10s';
assert(Number.isInteger(count) && count >= 2 && count <= 30 && /^\d{1,2}s$/.test(duration));
assert(process.env.LIVEKIT_PUBLIC_URL === 'ws://localhost:7880', 'Use the loopback LiveKit stack');
assert(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET, 'Load the local .env');
const publishers = Math.max(1, Math.floor(count / 4));
const command = process.env.LK_BIN ?? 'lk';
const result = spawnSync(
  command,
  [
    'perf',
    'load-test',
    '--duration',
    duration,
    '--audio-publishers',
    String(publishers),
    '--subscribers',
    String(count - publishers),
    '--num-per-second',
    '15',
  ],
  {
    stdio: 'inherit',
    timeout: 110_000,
    env: { ...process.env, LIVEKIT_URL: process.env.LIVEKIT_PUBLIC_URL },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
