// packages/prerender/src/server.ts
import express from 'express';
import { render } from './renderer';
import { config } from './config';

const app = express();

app.get('/render', async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    res.status(400).send('Missing url query param');
    return;
  }

  try {
    const { html, cache } = await render(url);

    res.setHeader('X-Prerender-Cache', cache);
    res.setHeader('X-Prerender-Cache-TTL-seconds', config.cacheTtlSeconds);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('Render failed');
  }
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.listen(config.port, () => {
  console.log(`[prerender] listening on ${config.port}`);
});
