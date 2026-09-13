const PROVIDERS = {
  hcai: {
    url: 'https://ai.hackclub.com/proxy/v1/chat/completions',
    key: env => env.HCAI,
    model: env => env.HCAI_MODEL || 'google/gemini-3.8-flash',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: env => env.OPENROUTER_API_KEY,
    model: env => env.OPENROUTER_MODEL || 'google/gemini-3.8-flash',
    headers: { 'HTTP-Referer': 'https://banking.southbag.cc', 'X-Title': 'Southbag Online Banking' },
  },
};
const ORDER = ['hcai', 'openrouter'];

export function aiConfigured(env) {
  return ORDER.some(name => PROVIDERS[name].key(env));
}

function extractText(data) {
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error(`AI response missing choices: ${JSON.stringify(data)}`);
  if (typeof message.content === 'string' && message.content.trim()) return message.content;
  if (Array.isArray(message.content)) {
    const text = message.content.map(part => (typeof part === 'string' ? part : part.text)).filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  if (typeof message.refusal === 'string' && message.refusal.trim()) return message.refusal;
  throw new Error(`AI response had no text content: ${JSON.stringify(data)}`);
}

async function complete(provider, messages, env, fetchImpl) {
  const response = await fetchImpl(provider.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.key(env)}`, ...(provider.headers || {}) },
    body: JSON.stringify({ model: provider.model(env), messages }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(data).slice(0, 300)}`);
  return extractText(data);
}

// Shared by the web chat and the Slack bot: Hack Club AI first, OpenRouter if that fails.
export async function chat(messages, env, fetchImpl = fetch) {
  const failures = [];
  for (const name of ORDER) {
    const provider = PROVIDERS[name];
    if (!provider.key(env)) continue;
    try {
      return await complete(provider, messages, env, fetchImpl);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      console.error(`AI provider ${name} failed:`, error.message);
    }
  }
  if (!failures.length) throw new Error('No AI provider is configured (set HCAI and/or OPENROUTER_API_KEY)');
  throw new Error(`All AI providers failed — ${failures.join(' | ')}`);
}
