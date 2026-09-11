// CASEVAULT Backend Express Entry Point

import express from 'express';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[CASEVAULT Backend] Express Server running on http://localhost:${PORT}`);
  });
}

export default app;

