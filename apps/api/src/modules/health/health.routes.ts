import type { FastifyPluginAsync } from 'fastify';
import type { AppDeps } from '../../app';

export const healthRoutes: FastifyPluginAsync<{ deps: AppDeps }> = async (app, { deps }) => {
  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_request, reply) => {
    try {
      await deps.pool.query('SELECT 1');
      return { status: 'ready', database: 'ok' };
    } catch {
      return reply.status(503).send({ status: 'unavailable', database: 'unreachable' });
    }
  });
};
