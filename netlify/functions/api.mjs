import { getStore } from '@netlify/blobs';
import { createApi } from '../../public/core.js';
import { agentTemplate } from './_agent.mjs';

function blobStore() {
  const s = getStore({ name: 'ranked', consistency: 'strong' });
  return {
    get: k => s.get(k, { type: 'json' }),
    set: (k, v) => s.setJSON(k, v),
    // optimistic concurrency: retry on ETag conflict so parallel writes never overwrite each other
    async update(k, fn) {
      for (let i = 0; i < 8; i++) {
        const cur = await s.getWithMetadata(k, { type: 'json' });
        const next = await fn(cur ? cur.data : null);
        const res = cur
          ? await s.setJSON(k, next, { onlyIfMatch: cur.etag })
          : await s.setJSON(k, next, { onlyIfNew: true });
        if (res.modified) return next;
        await new Promise(r => setTimeout(r, 40 + Math.random() * 160));
      }
      throw new Error('trop de requêtes en même temps, réessaie');
    },
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  let body = {};
  if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }
  const api = createApi(blobStore(), { agentTemplate, origin: url.origin });
  const r = await api(req.method, path, body);
  if (r.text != null) return new Response(r.text, { status: r.status, headers: r.headers });
  return Response.json(r.json, { status: r.status, headers: { 'cache-control': 'no-store' } });
};

export const config = { path: '/api/*' };
