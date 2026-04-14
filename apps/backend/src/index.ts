import 'dotenv/config';
import { buildServer } from './server.js';
import { prisma } from './db.js';

const server = await buildServer();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await server.listen({ port, host });
} catch (err) {
  server.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}
