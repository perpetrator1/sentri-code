import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import authRoutes from './routes/auth';
import problemRoutes from './routes/problems';
import executeRoutes from './routes/execute';
import submissionRoutes from './routes/submissions';
import examinerRoutes from './routes/examiner';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'sentri-code-backend',
    timestamp: Date.now(),
    offlineCapable: true,
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/examiner', examinerRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database & start server
try {
  initDatabase();
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🛡️ Sentri Code Backend running at http://localhost:${PORT}`);
    console.log(`📡 API Endpoints available at http://localhost:${PORT}/api`);
  });
} catch (e) {
  console.error('Fatal initialization error:', e);
  process.exit(1);
}
