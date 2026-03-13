import express from 'express';
import cookieParser from 'cookie-parser';
import videosRouter from './routes/videos.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import apiKeysRouter from './routes/apiKeys.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';
import { authenticate } from './middlewares/authenticate.js';

if (!process.env.COOKIE_SECRET) throw new Error('COOKIE_SECRET is not defined');

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// Public
app.use('/auth', authRouter);
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

// Human-only (cookie auth) — agents don't create API keys
app.use('/api-keys', requireAuth, apiKeysRouter);

// Human OR agent (cookie or Bearer token)
app.use('/videos', authenticate, videosRouter);
app.use('/search', authenticate, searchRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});