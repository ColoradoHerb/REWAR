import Fastify from 'fastify';
import sessionsRoutes from './routes/sessions.js';
import worldRoutes from './routes/world.js';
import commandsRoutes from './routes/commands.js';

export function buildApp() {
  const app = Fastify({
    logger: true,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET,POST,OPTIONS');
    reply.header('access-control-allow-headers', 'content-type');

    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  app.get('/health', async () => {
    return {
      ok: true as const,
      service: 'rewar-server',
    };
  });

  app.register(sessionsRoutes);
  app.register(worldRoutes);
  app.register(commandsRoutes);

  return app;
}
