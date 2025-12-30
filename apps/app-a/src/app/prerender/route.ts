import { NextResponse } from 'next/server';

const PRERENDER_ORIGIN = process.env.PRERENDER_ORIGIN ?? 'http://localhost:4000';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 });
  }

  const res = await fetch(`${PRERENDER_ORIGIN}/render?url=${encodeURIComponent(targetUrl)}`, {
    // ❗ Next 캐시 완전 차단
    cache: 'no-store',
  });

  const html = await res.text();

  return new NextResponse(html, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Prerender-Cache': res.headers.get('x-prerender-cache') ?? 'UNKNOWN',
    },
  });
}
