export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!process.env.HCAI) {
      return res.status(500).json({ error: 'Missing HCAI environment variable' });
    }

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Missing messages array' });
    }

    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HCAI}`
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText || 'AI provider request failed' });
    }

    const data = await response.json();
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Unexpected API response:', data);
      return res.status(502).json({ error: 'Unexpected AI provider response' });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
}
