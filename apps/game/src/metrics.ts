import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry, prefix: 'mini_game_' });
export const players = new Gauge({
  name: 'mini_game_players',
  help: 'Players in the room, including reconnecting',
  registers: [registry],
});
export const reservations = new Gauge({
  name: 'mini_game_seats_reserved',
  help: 'Seats awaiting a WebSocket handshake',
  registers: [registry],
});
export const tick = new Histogram({
  name: 'mini_game_tick_duration_seconds',
  help: 'Room simulation callback duration',
  registers: [registry],
  buckets: [0.0001, 0.001, 0.005, 0.016, 0.03, 0.1],
});
export const reconnect = new Counter({
  name: 'mini_game_reconnect_total',
  help: 'Room reconnect events',
  labelNames: ['outcome'],
  registers: [registry],
});
export const voice = new Counter({
  name: 'mini_game_voice_total',
  help: 'Voice grant outcomes',
  labelNames: ['outcome'],
  registers: [registry],
});
