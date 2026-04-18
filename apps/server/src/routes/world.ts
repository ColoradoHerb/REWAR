import type { FastifyPluginAsync } from 'fastify';
import { getWorldState } from '../modules/world/index.js';

const worldRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { sessionId: string } }>('/api/sessions/:sessionId/world', async (request, reply) => {
    const worldState = await getWorldState(request.params.sessionId);

    if (!worldState) {
      reply.code(404);
      return {
        message: `Session ${request.params.sessionId} was not found.`,
      };
    }

    return { worldState };
  });
};

export default worldRoutes;
