import express from 'express';
import path from 'path';
import cors from 'cors';
import apiHandler from './api/[...path]';

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors());

// Keep API request bodies untouched. The shared API handler reads the raw stream,
// which is also required for Stripe webhook signature verification.
app.all('/api/*', async (req, res) => {
  try {
    await apiHandler(req as any, res as any);
  } catch (error) {
    console.error('API handler failed:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Erro interno do servidor.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mini Diagnóstico running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});
