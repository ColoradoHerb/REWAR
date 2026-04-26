import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { STARTER_WORLD_ID, US48_WORLD_ID } from '@rewar/shared';
import { createSeededSession } from '../modules/session/index.js';

const createSessionSchema = z.object({
  seedWorldId: z.enum([STARTER_WORLD_ID, US48_WORLD_ID]),
  replaceSessionId: z.string().min(1).optional(),
});

const sessionsRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/sessions', async (request, reply) => {
    const parsedRequest = createSessionSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      reply.code(400);
      return {
        message: 'Session creation payload is invalid.',
      };
    }

    const session = await createSeededSession(parsedRequest.data);

    reply.code(201);
    return session;
  });
};

export default sessionsRoutes;
