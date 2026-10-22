import express from 'express';
import helmet from 'helmet';
import { config } from './config/index.js';
import { originCheck } from './middleware/auth.js';
import { cors } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { requestLogger } from './middleware/requestLogger.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet()); // security headers
  app.use(requestLogger);
  app.use(cors); // answers preflights before rate limiting or body parsing
  app.use(globalLimiter); // cheap rejection first: before parsing bodies or touching the database
  app.use(express.json({ limit: '100kb' })); // payload-size cap
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(originCheck);

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
