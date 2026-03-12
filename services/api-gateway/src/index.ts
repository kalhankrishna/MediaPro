import express from 'express';
import cookieParser from 'cookie-parser';
import videosRouter from './routes/videos.js';
import searchRouter from './routes/search.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';

if (!process.env.COOKIE_SECRET) throw new Error('COOKIE_SECRET is not defined');

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use('/auth', authRouter);
app.use('/videos', requireAuth, videosRouter);
app.use('/search', requireAuth, searchRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});