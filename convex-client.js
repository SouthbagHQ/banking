// Southbag Convex Client - chat history only

var _convexReady = (async function() {
  if (!window.__CONVEX_URL) {
    try {
      var res = await fetch('/api/config');
      var data = await res.json();
      window.__CONVEX_URL = data.convexUrl;
    } catch(e) {}
  }
})();

function getSouthbagClient() {
  if (!window.__southbagConvex && window.__CONVEX_URL) {
    window.__southbagConvex = new convex.ConvexHttpClient(window.__CONVEX_URL);
  }
  return window.__southbagConvex;
}

function getSessionId() {
  var sid = localStorage.getItem('sb_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('sb_session_id', sid);
  }
  return sid;
}

var SouthbagDB = {
  saveChatHistory: async function(messages) {
    await _convexReady;
    var client = getSouthbagClient();
    if (!client) return;
    var sessionId = getSessionId();
    await client.mutation(convex.anyApi.chat.saveHistory, {
      sessionId: sessionId,
      messages: messages,
    });
  },

  getChatHistory: async function() {
    await _convexReady;
    var client = getSouthbagClient();
    if (!client) return [];
    var sessionId = getSessionId();
    return await client.query(convex.anyApi.chat.getHistory, { sessionId: sessionId });
  },

  getAllChatHistory: async function() {
    await _convexReady;
    var client = getSouthbagClient();
    if (!client) return [];
    return await client.query(convex.anyApi.chat.getAllHistory, {});
  },
};
