import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import videosRouter from './routes/videos.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import apiKeysRouter from './routes/apiKeys.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { authenticate } from './middlewares/authenticate.js';
import logger from './lib/logger.js';
import { generalLimiter, authLimiter, searchLimiter } from './lib/rateLimiter.js';

if (!process.env.COOKIE_SECRET) throw new Error('COOKIE_SECRET is not defined');
if (!process.env.FRONTEND_URL) throw new Error('FRONTEND_URL is not defined');

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.set('trust proxy', 1);
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(generalLimiter);

// Public
app.use('/auth', authLimiter, authRouter);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

// Human-only (cookie auth) — agents don't create API keys
app.use('/api-keys', requireAuth, apiKeysRouter);

// Human OR agent (cookie or Bearer token)
app.use('/videos', authenticate, videosRouter);
app.use('/search', authenticate, searchLimiter, searchRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API Gateway running');
});
