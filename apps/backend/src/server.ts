import Fastify from 'fastify';
import cors from '@fastify/cors';
import { publicRoutes } from './routes/public.js';
import { manageRoutes } from './routes/manage.js';

export async function buildServer() {
  const server = Fastify({ logger: true });

  await server.register(cors, { origin: true });

  await server.register(publicRoutes, { prefix: '/api/calendars' });
  await server.register(manageRoutes, { prefix: '/api/manage' });

  server.setErrorHandler((error, _request, reply) => {
    server.log.error(error);
    const status = error.statusCode ?? 500;
    reply.status(status).send({ code: status, message: error.message ?? 'Internal server error' });
  });

  return server;
}
