import type { FastifyPluginAsync } from 'fastify';

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/sessions', async (_request, reply) => {
    reply.code(501);
    return {
      message: 'Session creation is scaffolded but not implemented yet.',
    };
  });
};

export default sessionsRoutes;

