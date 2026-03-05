import express from 'express';
import videosRouter from './routes/videos.js';
import searchRouter from './routes/search.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);

app.use(express.json());

app.use('/videos', videosRouter);
app.use('/search', searchRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});