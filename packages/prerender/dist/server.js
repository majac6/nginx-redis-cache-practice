// src/server.ts
import express from "express";

// src/cache.ts
import Redis from "ioredis";

// src/config.ts
var config = {
  port: Number(process.env.PORT ?? 4e3),
  redisUrl: process.env.REDIS_URL ?? "redis://:local-dev-redis@127.0.0.1:6379",
  cachePrefix: process.env.PRERENDER_CACHE_PREFIX ?? "prerender:"
};

// src/cache.ts
var redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});
async function getCache(key) {
  return redis.get(key);
}
async function setCache(key, value, ttlSeconds) {
  if (ttlSeconds && ttlSeconds > 0) {
    await redis.set(key, value, "EX", ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}

// src/cache-key.ts
import crypto from "crypto";
function buildCacheKey(url) {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  return `${config.cachePrefix}${hash}`;
}

// src/renderer.ts
async function render(url) {
  const key = buildCacheKey(url);
  const cached = await getCache(key);
  if (cached) {
    return { html: cached, cache: "HIT" };
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": "prerender-service"
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const html = await res.text();
  await setCache(key, html);
  return { html, cache: "MISS" };
}

// src/server.ts
var app = express();
app.get("/render", async (req, res) => {
  const url = req.query.url;
  if (!url) {
    res.status(400).send("Missing url query param");
    return;
  }
  try {
    const { html, cache } = await render(url);
    res.setHeader("X-Prerender-Cache", cache);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Render failed");
  }
});
app.listen(config.port, () => {
  console.log(`[prerender] listening on ${config.port}`);
});
