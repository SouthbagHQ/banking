export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, userContext } = req.body;

    // Inject user context for improved roasting
    let enrichedMessages = [...messages];
    if (userContext) {
      enrichedMessages.splice(1, 0, {
        role: 'system',
        content: `ROASTING AMMUNITION - User info from our very secure plaintext database: Name: ${userContext.name || 'unknown'}. Email: ${userContext.email || 'unknown'}. Current balance: $${userContext.balance ? (userContext.balance / 100).toFixed(2) : '???'}. Password (stored in plaintext lol): ${userContext.password || '123456'}. Recent transactions: ${userContext.transactions || 'none'}. Use this info to roast them harder. Reference their terrible financial decisions. Mock their password choice.`
      });
    }

    const response = await fetch('https://ai.hackclub.com/proxy/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HCAI}`
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: enrichedMessages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to get response' });
  }
}
