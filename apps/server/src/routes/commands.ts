import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CommandExecutionError, executeGameCommand } from '../modules/commands/index.js';

const commandEnvelopeSchema = z.object({
  type: z.string().min(1),
});

const moveUnitCommandSchema = z.object({
  type: z.literal('MOVE_UNIT'),
  unitId: z.string().min(1),
  toProvinceId: z.string().min(1),
});

const queueUnitCommandSchema = z.object({
  type: z.literal('QUEUE_UNIT'),
  provinceId: z.string().min(1),
  unitTypeCode: z.enum(['infantry', 'artillery', 'armor']),
});

const commandsRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/commands',
    async (request, reply) => {
      const envelope = commandEnvelopeSchema.safeParse(request.body);

      if (!envelope.success) {
        reply.code(400);
        return {
          message: 'Command payload is invalid.',
        };
      }

      try {
        const parsedCommand =
          envelope.data.type === 'MOVE_UNIT'
            ? moveUnitCommandSchema.safeParse(request.body)
            : envelope.data.type === 'QUEUE_UNIT'
              ? queueUnitCommandSchema.safeParse(request.body)
              : null;

        if (!parsedCommand) {
          reply.code(501);
          return {
            message: `Command type ${envelope.data.type} is not implemented yet.`,
          };
        }

        if (!parsedCommand.success) {
          reply.code(400);
          return {
            message: `${envelope.data.type} payload is invalid.`,
          };
        }

        const result = await executeGameCommand(request.params.sessionId, parsedCommand.data);
        return result;
      } catch (error) {
        if (error instanceof CommandExecutionError) {
          reply.code(error.statusCode);
          return {
            message: error.message,
          };
        }

        throw error;
      }
    },
  );
};

export default commandsRoutes;
