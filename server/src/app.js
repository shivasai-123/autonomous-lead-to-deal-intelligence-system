import express from 'express';
import cors from 'cors';
import { env } from './config/environment.js';
import { logger } from './utils/logger.js';
import apiRouter from './routes/index.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Enable CORS with configured client origin
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// Parse incoming JSON and urlencoded payloads
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Catch 404 and forward to error handler
app.use(notFoundHandler);

// Centralized error handling
app.use(errorHandler);

export default app;
