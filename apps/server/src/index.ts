import { DEFAULT_SERVER_PORT } from '@rewar/shared';
import { buildApp } from './app.js';

async function start() {
  const app = buildApp();

  try {
    await app.listen({
      host: '0.0.0.0',
      port: Number(process.env.PORT ?? DEFAULT_SERVER_PORT),
    });

    app.log.info('REWAR server scaffold is running');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();

