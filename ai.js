const AI_URL = 'https://ai.hackclub.com/proxy/v1/chat/completions';
const MODEL = 'google/gemini-3-flash-preview';

// Shared Hack Club AI proxy call used by the web chat and the Slack bot.
export async function chat(messages, env) {
  if (!env?.HCAI) throw new Error('HCAI is not configured');
  const response = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.HCAI}` },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`AI request failed: ${response.status} ${JSON.stringify(data)}`);
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
