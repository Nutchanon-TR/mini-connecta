import { readPreview, writePreview } from '@/features/preview/browser-storage';
import { readPreviewAvatar, savePreviewAvatar } from '@/features/avatar/preview-avatar';
import type { components, paths } from './api.types';
import { isMockApi } from './api-mode';

type Avatar = components['schemas']['Avatar'];
type CurrentAccount = components['schemas']['CurrentAccount'];
type ApiError = components['schemas']['ApiError'];
type StudyRoomTicket = components['schemas']['StudyRoomTicket'];
type RoomAttemptEvent = components['schemas']['RoomAttemptEvent'];

const demoUser = { id: 'usr_demo' };
const routes = {
  account: '/api/me', avatar: '/api/me/avatar', join: '/api/rooms/study-room/join',
  telemetry: '/api/telemetry/room-attempts',
} satisfies Record<string, keyof paths>;

type Scenario = 'session-expired' | 'save-error' | 'join-error';
let scenario: { path: typeof routes.avatar | typeof routes.join; value: Scenario } | undefined;

export function queueMockScenario(operation: 'avatar' | 'join', value: string) {
  if (!isMockApi) return;
  const failure = operation === 'avatar' ? 'save-error' : 'join-error';
  scenario = value === 'session-expired' || value === failure ? { path: routes[operation], value } : undefined;
}

const headers = { 'Cache-Control': 'no-store' };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const joinOutcomes = new Set(['success', 'room_full', 'already_in_room', 'auth_required', 'avatar_required', 'cancelled', 'timeout', 'failed']);
const voiceOutcomes = new Set(['success', 'cancelled', 'timeout', 'failed']);

function json<T>(body: T, status = 200) {
  return Response.json(body, { status, headers });
}

function failure(status: number, code: ApiError['error']['code'], message: string, fields?: ApiError['error']['fields']) {
  return json<ApiError>({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

function isBody(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAttemptEvent(value: unknown): value is RoomAttemptEvent {
  if (!isBody(value) || typeof value.attemptId !== 'string' || !uuid.test(value.attemptId)) return false;
  if (value.kind !== 'join' && value.kind !== 'voice') return false;
  if (value.phase === 'start') return Object.keys(value).length === 3;
  const outcomes = value.kind === 'join' ? joinOutcomes : voiceOutcomes;
  return value.phase === 'finish' && Object.keys(value).length === 5
    && typeof value.outcome === 'string' && outcomes.has(value.outcome)
    && typeof value.durationMs === 'number' && Number.isFinite(value.durationMs) && value.durationMs >= 0;
}

function putAvatar(body: unknown) {
  if (!isBody(body) || Object.keys(body).length !== 2) {
    return failure(400, 'validation_error', 'Enter a display name and choose a look.');
  }
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  if (!displayName || Array.from(displayName).length > 16 || /[\u0000-\u001f\u007f-\u009f]/.test(displayName)) {
    return failure(400, 'validation_error', 'Enter a valid display name (1–16 characters).', { displayName: 'invalid' });
  }
  if (body.preset !== 'strawberry' && body.preset !== 'matcha') {
    return failure(400, 'validation_error', 'Choose a supported look.', { preset: 'invalid' });
  }
  const avatar: Avatar = { displayName, preset: body.preset };
  return savePreviewAvatar(avatar)
    ? json<Avatar>(avatar)
    : failure(503, 'service_unavailable', 'Allow browser storage and try saving again.');
}

export const mockApiFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request && init === undefined ? input : new Request(input, init);
  const { pathname } = new URL(request.url);
  const activeScenario = scenario?.path === pathname ? scenario.value : undefined;
  if (activeScenario) scenario = undefined;
  request.signal.throwIfAborted();

  if (activeScenario === 'session-expired') writePreview('signed-in', null);
  if (readPreview('signed-in') !== 'true') return failure(401, 'unauthorized', 'Sign in to continue.');

  if (request.method === 'GET' && pathname === routes.account) {
    return json<CurrentAccount>({ user: demoUser, avatar: readPreviewAvatar() });
  }
  if (request.method === 'PUT' && pathname === routes.avatar && activeScenario === 'save-error') {
    return failure(503, 'service_unavailable', 'Your character couldn’t be saved.');
  }
  if (request.method === 'POST' && pathname === routes.join && !readPreviewAvatar()) {
    return failure(409, 'avatar_required', 'Create a character before joining.');
  }

  const writeRoute = (request.method === 'PUT' && pathname === routes.avatar)
    || (request.method === 'POST' && (pathname === routes.join || pathname === routes.telemetry));
  if (!writeRoute) return new Response(null, { status: 404, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure(400, 'validation_error', 'Send a JSON body.');
  }
  request.signal.throwIfAborted();

  if (pathname === routes.avatar) return putAvatar(body);
  if (pathname === routes.telemetry) {
    return isAttemptEvent(body)
      ? new Response(null, { status: 204, headers })
      : failure(400, 'validation_error', 'Invalid attempt event.');
  }

  if (!isBody(body) || Object.keys(body).length !== 1 || typeof body.attemptId !== 'string' || !uuid.test(body.attemptId)) {
    return failure(400, 'validation_error', 'Invalid attempt ID.', { attemptId: 'invalid' });
  }
  if (activeScenario === 'join-error') return failure(503, 'room_unavailable', 'Study Room is unavailable.');
  return json<StudyRoomTicket>({
    roomId: 'study-room',
    gameRoomId: 'study-room-preview',
    gameWsUrl: 'ws://localhost:2567',
    joinTicket: 'mock-study-room-ticket',
    expiresAt: new Date(Date.now() + 45_000).toISOString(),
  });
};
