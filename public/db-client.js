var SouthbagDB = {
  saveChatHistory: async function(messages) {
    var response = await fetch('/api/chat', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
    });
    if (response.status === 401) window.location.href = '/auth/login';
    if (!response.ok) throw new Error('Could not save chat history');
  },
  getChatHistory: async function() {
    var response = await fetch('/api/chat');
    if (response.status === 401) {
      window.location.href = '/auth/login';
      return [];
    }
    if (!response.ok) throw new Error('Could not load chat history');
    return (await response.json()).messages;
  },
};
