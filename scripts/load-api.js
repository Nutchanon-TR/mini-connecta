import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const sessions = new SharedArray('local fixture accounts', () =>
  JSON.parse(open('/data/load-sessions.json')),
);
const origin = 'http://localhost:8080';
const base = (__ENV.API_ORIGIN || 'http://caddy:8080').replace(/\/$/, '');
const mode = __ENV.API_MODE || 'flow';
if (mode !== 'flow' && mode !== 'me') throw new Error('API_MODE must be flow or me.');
if (mode === 'me' && !/^http:\/\/(?:caddy|localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(base)) {
  throw new Error('API_MODE=me requires a local API origin.');
}
export const options = {
  vus: Number(__ENV.USERS || 5),
  duration: __ENV.DURATION || '10s',
  thresholds: {
    http_req_failed: ['rate<0.005'],
    http_req_duration: ['p(99)<300'],
    checks: ['rate>0.995'],
  },
};

function accountMatchesFixture(response, user) {
  if (response.status !== 200) return false;
  try {
    const body = response.json();
    return (
      body?.user?.id === user.id &&
      body?.avatar?.displayName === user.name &&
      body?.avatar?.preset === 'matcha'
    );
  } catch {
    return false;
  }
}

export default function () {
  const user = sessions[__VU - 1];
  const headers = { Cookie: user.cookie, Origin: origin, 'Content-Type': 'application/json' };
  const account = http.get(
    base + '/api/me',
    mode === 'me' ? { headers, redirects: 0 } : { headers },
  );
  check(account, { 'account returned 200': (response) => response.status === 200 });
  if (mode === 'me') {
    check(account, {
      'account and avatar match fixture': (response) => accountMatchesFixture(response, user),
    });
  } else {
    const attemptId = '00000000-0000-4000-8000-' + String(__VU * 1000 + __ITER).padStart(12, '0');
    const ticket = http.post(base + '/api/rooms/study-room/join', JSON.stringify({ attemptId }), {
      headers,
    });
    check(ticket, { 'ticket issued': (response) => response.status === 200 });
  }
  sleep(1);
}
