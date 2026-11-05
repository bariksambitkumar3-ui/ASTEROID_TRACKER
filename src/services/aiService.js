/**
 * ASTRA AI Service
 *
 * Architecture:
 *   Browser → POST /api/ai/chat (local Vite proxy) → Gemini API (server-side)
 *
 * The Gemini API key is stored in GEMINI_API_KEY (no VITE_ prefix) and is
 * NEVER sent to the browser or bundled into client JavaScript.
 *
 * Fallback: If the proxy is unreachable or returns an error, the built-in
 * knowledge base answers asteroid/ASTRA questions without any AI call.
 */

// ─── Proxy endpoint (Vite middleware, server-side only) ──────────────────────
const PROXY_URL = '/api/ai/chat';

// ─── System prompt injected on the server side ──────────────────────────────
// (kept here for reference — the proxy sends this to Gemini, not the browser)
export const SYSTEM_PROMPT = `You are ASTRA AI, the knowledgeable and friendly assistant for the ASTRA 3D Asteroid & Solar System Explorer. Answer all questions helpfully — both ASTRA-specific questions AND general knowledge questions.

## About ASTRA
ASTRA is a real-time asteroid tracking and solar system exploration platform powered by NASA's Near-Earth Object Web Service (NeoWs) API and Three.js 3D rendering.

### Dashboard
- Shows live statistics: tracked asteroids, dangerous count, avg miss distance, avg velocity, closest approach.
- Stat cards refresh every 15 minutes using NASA's NeoWs API.
- Charts show size distribution and velocity comparisons.

### Asteroid Threat Colors
- RED = Dangerous / Potentially Hazardous Asteroid (PHA). Miss distance < 0.05 AU or NASA-flagged.
- YELLOW = Medium threat. Miss distance 0.05–0.2 AU. Monitor closely.
- GREEN = Safe. Miss distance > 0.2 AU. No immediate threat.

### 3D Solar System View
- Click "3D Solar System" in the sidebar. Left-click drag = rotate, scroll = zoom, right-click drag = pan.
- Asteroid spheres are Red/Yellow/Green by threat. Click any to see details.

### Asteroid Catalog
- Filter: All / Dangerous / Medium / Safe buttons. Search by name. Sort by clicking column headers.

### Weather & Space Panel
- Earth weather for configured city. Space weather: solar activity, Kp index, radiation belts.

### Key Data Fields
- Miss Distance: closest pass distance in km / AU (1 AU = 149.6 million km)
- Relative Velocity: speed at closest approach in km/s
- Close Approach Date: date/time of nearest pass to Earth
- Estimated Diameter: size in meters from NASA brightness data
- PHA: Potentially Hazardous Asteroid — >140m AND miss distance <0.05 AU

## Style
Be concise, friendly, and helpful. Use bullet points for instructions. Use space emojis occasionally. Answer general knowledge questions too — you are not limited to ASTRA topics.`;

// ─── Built-in fallback knowledge base ───────────────────────────────────────
// Used when the proxy server is unreachable. Never silently replaces real AI.

const KNOWLEDGE_BASE = [
  {
    keys: ['solar system', '3d view', 'solar', 'orbit', 'planet'],
    answer:
      '🌌 To explore the **3D Solar System**, click "3D Solar System" in the left sidebar.\n\nControls:\n• Left-click + drag → rotate\n• Scroll wheel → zoom in/out\n• Right-click + drag → pan\n\nClick any colored asteroid sphere to see its full details. Red = dangerous, Yellow = medium, Green = safe.',
  },
  {
    keys: ['dangerous', 'red', 'hazardous', 'pha', 'threat'],
    answer:
      '🔴 **Red asteroids** are Potentially Hazardous Asteroids (PHAs) — miss distance < 0.05 AU or officially flagged by NASA.\n\nTo find them:\n1. Go to the Asteroid Catalog tab\n2. Click the red **"Dangerous"** filter button\n3. Sort by **Miss Distance** (ascending) for closest first\n4. In the 3D view, look for red spheres',
  },
  {
    keys: ['yellow', 'medium', 'caution', 'flyby'],
    answer:
      '🟡 **Yellow asteroids** indicate a medium-threat close flyby — miss distance between 0.05 and 0.2 AU. Monitor these but they pose no immediate danger.',
  },
  {
    keys: ['green', 'safe'],
    answer:
      '🟢 **Green asteroids** are safe — miss distance > 0.2 AU. No immediate threat to Earth.',
  },
  {
    keys: ['miss distance', 'au', 'distance'],
    answer:
      '📏 **Miss Distance** is how far the asteroid passes from Earth at closest approach.\n• Shown in km and AU\n• 1 AU ≈ 149.6 million km\n• Under 0.05 AU = potentially hazardous threshold',
  },
  {
    keys: ['velocity', 'speed', 'km/s', 'fast'],
    answer:
      "⚡ **Relative Velocity** is the asteroid's speed relative to Earth at closest approach, measured in km/s. Most near-Earth asteroids travel between 5–30 km/s.",
  },
  {
    keys: ['close approach', 'approach date', 'when'],
    answer:
      '📅 **Close Approach Date** is when the asteroid makes its nearest pass to Earth. ASTRA shows the next 7 days of close approaches from today, fetched live from NASA.',
  },
  {
    keys: ['diameter', 'size', 'big', 'large', 'small'],
    answer:
      "📐 **Estimated Diameter** is NASA's size estimate based on the asteroid's absolute magnitude (brightness). Shown in meters. Asteroids > 140m are tracked as potentially hazardous if they also have a close orbit.",
  },
  {
    keys: ['weather', 'space weather', 'solar wind', 'geomagnetic', 'kp'],
    answer:
      '🌤️ The **Weather & Space** tab shows:\n• Earth weather for your configured city (temperature, humidity, wind)\n• Space weather: solar activity, Kp geomagnetic index, radiation belt status (from NOAA)',
  },
  {
    keys: ['catalog', 'filter', 'search', 'table', 'sort', 'list'],
    answer:
      "📋 **Asteroid Catalog** tips:\n• Use colored filter buttons: All / Dangerous / Medium / Safe\n• Search by name in the search box\n• Click column headers to sort ascending/descending\n• Each row links to NASA's JPL database",
  },
  {
    keys: ['api', 'nasa', 'key', 'refresh', 'data', 'update', 'live'],
    answer:
      "🔄 ASTRA uses **NASA's NeoWs API** (Near Earth Object Web Service).\n• Data auto-refreshes every 15 minutes\n• Click **Refresh Data** for instant update\n• Add your free NASA API key (from api.nasa.gov) in .env as VITE_NASA_API_KEY for 1,000 req/hr",
  },
  {
    keys: ['dashboard', 'stats', 'card', 'overview', 'statistics'],
    answer:
      '📊 The **Dashboard** shows:\n• Total asteroids tracked\n• Dangerous / Medium / Safe counts\n• Average miss distance and velocity\n• Closest and largest current asteroids\n• Size distribution and velocity charts',
  },
  {
    keys: ['gemini', 'ai', 'assistant', 'help', 'chatbot'],
    answer:
      "🤖 I'm **ASTRA AI**, powered by Google Gemini 1.5 Flash!\n\nI can answer:\n• ASTRA navigation questions\n• Asteroid threat level explanations\n• NASA data field definitions\n• General knowledge questions\n\nTo enable me: add a free AI Studio key at [aistudio.google.com](https://aistudio.google.com/app/apikey) as GEMINI_API_KEY in your .env file.",
  },
  {
    keys: ['hello', 'hi', 'hey', 'greetings', 'start', 'begin'],
    answer:
      "👋 Hello! I'm **ASTRA AI**, your guide to the Asteroid & Solar System Explorer.\n\nI can help you:\n• Navigate the 3D Solar System view\n• Understand asteroid threat levels (Red/Yellow/Green)\n• Find dangerous asteroids\n• Explain NASA data fields (miss distance, velocity, diameter)\n• Answer general knowledge questions\n\nWhat would you like to explore? 🚀☄️",
  },
];

function fallbackAnswer(message) {
  const lower = (message || '').toLowerCase();
  for (const item of KNOWLEDGE_BASE) {
    if (item.keys.some((k) => lower.includes(k))) {
      return item.answer;
    }
  }
  // Generic fallback for general questions when proxy is offline
  return (
    "I'm **ASTRA AI** — currently running in offline mode (the AI server is not reachable).\n\n" +
    'I can still answer questions about:\n' +
    '• 🌍 3D Solar System navigation\n' +
    '• ☄️ Asteroid threat colors (Red/Yellow/Green)\n' +
    '• 📏 NASA data fields (miss distance, velocity, diameter)\n' +
    '• 📊 Dashboard and catalog features\n\n' +
    'For full AI (including general questions), make sure the dev server is running (`npm run dev`) and your `GEMINI_API_KEY` is set in `.env`.'
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a proxy error response into a user-friendly message */
function formatProxyError(errorCode, message, detail) {
  switch (errorCode) {
    case 'NO_KEY':
      return (
        '🔑 **No Gemini API key configured.**\n\n' +
        'To enable ASTRA AI:\n' +
        '1. Get a **free** AI Studio key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)\n' +
        '2. Make sure the key starts with `AIza` (NOT `AQ.` — that is a Cloud Console key)\n' +
        '3. Add it to your `.env` file as: `GEMINI_API_KEY=AIza...`\n' +
        '4. Restart the dev server (`npm run dev`)'
      );
    case 'KEY_INVALID_OR_BILLING':
      return (
        '⚠️ **API key error — billing or wrong key type.**\n\n' +
        '**Most likely cause:** You are using a **Google Cloud Console key** (starts with `AQ.`) instead of an **AI Studio key** (starts with `AIza`).\n\n' +
        'Fix:\n' +
        '1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)\n' +
        '2. Create a new key — it will start with `AIza`\n' +
        '3. Update `GEMINI_API_KEY` in your `.env` file\n' +
        '4. Restart the dev server\n\n' +
        (detail ? `*Technical detail: ${detail}*` : '')
      );
    case 'RATE_LIMITED':
      return (
        '⏱️ **Rate limit reached.**\n\n' +
        'The free tier allows **15 requests per minute**. Please wait a moment and try again.\n\n' +
        message
      );
    case 'ALL_MODELS_FAILED':
      return `⚠️ All Gemini models failed.\n\n${message}\n\nPlease check your API key and try again.`;
    default:
      return `⚠️ AI error: ${message || errorCode}`;
  }
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Send a conversation to the ASTRA AI proxy.
 * The proxy calls Gemini on the server side — the API key is never in browser code.
 *
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @returns {Promise<{ text: string, source: 'gemini'|'fallback', model?: string }>}
 */
export async function sendAIMessage(messages) {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  const lastContent = lastUserMsg?.content || '';

  // Build Gemini-compatible contents array — must start with 'user' role
  const filtered = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  let startIdx = 0;
  while (startIdx < filtered.length && filtered[startIdx].role !== 'user') startIdx++;
  const usable = filtered.slice(startIdx);

  if (usable.length === 0) {
    return { text: fallbackAnswer(lastContent), source: 'fallback' };
  }

  const contents = usable.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // ── Call the local Vite proxy (server-side Gemini) ──────────────────────
  try {
    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.75, maxOutputTokens: 1024, topP: 0.9 },
      }),
      signal: AbortSignal.timeout(25000),
    });

    const data = await res.json().catch(() => ({}));

    // ── Successful Gemini response ─────────────────────────────────────────
    if (res.ok && data.text) {
      return { text: data.text, source: 'gemini', model: data.model };
    }

    // ── Structured error from our proxy ───────────────────────────────────
    if (data.error) {
      const errText = formatProxyError(data.error, data.message, data.detail);
      return { text: errText, source: 'proxy-error', error: data.error };
    }

    // ── Unexpected response ────────────────────────────────────────────────
    return {
      text: `⚠️ Unexpected response from AI proxy (HTTP ${res.status}). Please try again.`,
      source: 'error',
    };

  } catch (err) {
    // Network error or proxy not running (e.g., production build without server)
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        text:
          '⏱️ The AI request timed out. The Gemini API might be slow — please try again.\n\n' +
          '*(Using built-in knowledge while AI is unavailable.)*\n\n---\n' +
          fallbackAnswer(lastContent),
        source: 'fallback',
      };
    }

    // Proxy not running (e.g., static build) — fall back silently
    console.warn('[ASTRA AI] Proxy unreachable:', err.message);
    return {
      text:
        fallbackAnswer(lastContent) +
        '\n\n---\n*ℹ️ Running in offline mode — start the dev server for full Gemini AI.*',
      source: 'fallback',
    };
  }
}
