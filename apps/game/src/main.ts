import { createServer } from 'node:http';
import { matchMaker, Server, ServerError } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { logEvent } from '@mini-connecta/shared/server-config';
import { config } from './config';
import { registry } from './metrics';
import { StudyRoom } from './study-room';

let room: StudyRoom | undefined;
const allowedOrigin = (origin: string | null) => origin === null || origin === config.APP_ORIGIN;
const transport = new WebSocketTransport({
  maxPayload: 4096,
  beforeUpgrade: (_url, ctx) =>
    allowedOrigin(ctx.headers.get('origin')) ? undefined : new Response(null, { status: 403 }),
});

const server = new Server({
  transport,
  greet: false,
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => logEvent('game', 'sdk_error'),
    debug: () => undefined,
  },
  express(app) {
    app.post('/matchmake/:method/:roomName', (req, res, next) => {
      if (!allowedOrigin(req.get('origin') ?? null)) {
        res.status(403).json({ error: 'Origin is invalid.' });
        return;
      }
      next();
    });
  },
});
const controller = matchMaker.controller;
controller.exposedMethods = ['joinById', 'reconnect'];
controller.getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': config.APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'false',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
});
const invoke = controller.invokeMethod.bind(controller);
controller.invokeMethod = async (method, id, options, context) => {
  if (!allowedOrigin(context?.headers.get('origin') ?? null))
    throw new ServerError(403, 'room_unavailable');
  if (!room || id !== room.roomId) throw new ServerError(522, 'room_unavailable');
  if (method === 'joinById')
    return room.reserve(options, () => invoke(method, id, options, context));
  return invoke(method, id, options, context);
};

server.define('study-room', StudyRoom);
await server.listen(config.GAME_PORT, '0.0.0.0');
const listing = await matchMaker.createRoom('study-room', {});
const instance = matchMaker.getLocalRoomById(listing.roomId);
if (!(instance instanceof StudyRoom)) throw new Error('Study Room failed to start');
room = instance;

const ops = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/metrics') {
    void registry.metrics().then(
      (data) => {
        res.setHeader('Content-Type', registry.contentType);
        res.end(data);
      },
      () => {
        res.writeHead(503).end();
      },
    );
  } else if (req.method === 'GET' && req.url === '/internal/room' && room) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ gameRoomId: room.roomId }));
  } else if (req.method === 'GET' && req.url === '/health/ready') {
    res.writeHead(room ? 200 : 503).end(room ? 'ready' : 'unavailable');
  } else {
    res.writeHead(404).end();
  }
});
ops.listen(config.GAME_INTERNAL_PORT, '0.0.0.0');
server.onBeforeShutdown(() => {
  room = undefined;
  ops.close();
});
logEvent('game', 'listening', { port: config.GAME_PORT });
