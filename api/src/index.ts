import express from 'express';
import cors from 'cors';
import './firebase.js';

import authRoutes from './routes/auth.js';
import filesRoutes from './routes/files.js';
import invitationsRoutes from './routes/invitations.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', authRoutes);
app.use('/api', filesRoutes);
app.use('/api/invitations', invitationsRoutes);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Only listen if NOT running on Vercel
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

export default app;
