import { logEvent } from '@mini-connecta/shared/server-config';
import { createApp } from './app';

const { app, runtime } = await createApp();
app.enableShutdownHooks();
await app.listen(runtime.env.API_PORT, '0.0.0.0');
logEvent('api', 'listening', { port: runtime.env.API_PORT });
