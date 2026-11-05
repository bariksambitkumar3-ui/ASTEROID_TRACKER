// vite-plugin-gemini-proxy.js
// Server-side middleware plugin for Vite.
// Intercepts POST /api/ai/chat requests and proxies them to the Gemini API.
// The API key is read from process.env (server-side only) and is NEVER sent
// to the browser or bundled into client JavaScript.

import { Buffer } from 'node:buffer';

// Models to try in order — first one that succeeds wins.
// All are on the AI Studio free tier.
const MODEL_FALLBACK_CHAIN = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
];

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Read the full request body from an IncomingMessage (Vite uses Node's http) */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Try one model, return { ok, status, data, error } */
async function tryModel(model, body, apiKey) {
  const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data, model };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message, model };
  }
}

export function geminiProxyPlugin() {
  return {
    name: 'astra-gemini-proxy',

    // configureServer runs in development only — the key stays on the server.
    configureServer(server) {
      server.middlewares.use('/api/ai/chat', async (req, res) => {
        // ── CORS pre-flight ──
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        // ── Read server-side key (NOT exposed to browser) ──
        const apiKey = process.env.GEMINI_API_KEY || '';
        if (!apiKey) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'NO_KEY',
              message:
                'GEMINI_API_KEY is not set in .env. ' +
                'Get a free AI Studio key at https://aistudio.google.com/app/apikey',
            })
          );
          return;
        }

        // ── Parse request body ──
        let reqBody;
        try {
          reqBody = JSON.parse(await readBody(req));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Invalid JSON body' }));
          return;
        }

        const { contents, system_instruction, generationConfig } = reqBody;
        if (!Array.isArray(contents) || contents.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'contents array is required' }));
          return;
        }

        const geminiBody = {
          ...(system_instruction ? { system_instruction } : {}),
          contents,
          generationConfig: generationConfig || {
            temperature: 0.75,
            maxOutputTokens: 1024,
            topP: 0.9,
          },
        };

        // ── Try models in fallback order ──
        let lastError = null;
        let lastStatus = 500;

        for (const model of MODEL_FALLBACK_CHAIN) {
          const result = await tryModel(model, geminiBody, apiKey);

          if (result.ok) {
            // ── Success ──
            const text =
              result.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
            const finishReason = result.data?.candidates?.[0]?.finishReason;

            if (!text && finishReason === 'SAFETY') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  text: '⚠️ That question was flagged by safety filters. Please rephrase.',
                  model,
                  blocked: true,
                })
              );
              return;
            }

            if (!text) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  text: 'No response generated. Please try again.',
                  model,
                  empty: true,
                })
              );
              return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ text, model, finishReason }));
            return;
          }

          // ── Handle specific error codes ──
          const errMsg = result.data?.error?.message || result.error || 'Unknown error';
          const status = result.status;

          // 429 = rate limit — stop trying immediately, tell user
          if (status === 429) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'RATE_LIMITED',
                message:
                  `Rate limit reached on ${model}. ` +
                  'The free tier allows 15 requests/minute. Please wait a moment and try again.',
              })
            );
            return;
          }

          // 403 / billing error — stop trying, the key itself is the problem
          if (
            status === 403 ||
            errMsg.includes('billing') ||
            errMsg.includes('free tier is not available') ||
            errMsg.includes('not supported') ||
            errMsg.includes('API_KEY_INVALID')
          ) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: 'KEY_INVALID_OR_BILLING',
                message:
                  'Your API key is invalid or requires billing to be enabled. ' +
                  'Make sure you are using an AI Studio key (starts with AIza), ' +
                  'not a Google Cloud Console key (starts with AQ.). ' +
                  'Get a free AI Studio key at https://aistudio.google.com/app/apikey',
                detail: errMsg,
              })
            );
            return;
          }

          // 404 = model not found — try next model in chain
          if (status === 404) {
            console.warn(`[ASTRA AI] Model ${model} not found, trying next...`);
            lastError = errMsg;
            lastStatus = status;
            continue;
          }

          // Other errors — try next model
          lastError = errMsg;
          lastStatus = status;
        }

        // All models exhausted
        res.writeHead(lastStatus || 500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'ALL_MODELS_FAILED',
            message: `All Gemini models failed. Last error: ${lastError}`,
          })
        );
      });
    },
  };
}
