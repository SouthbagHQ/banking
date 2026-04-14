// Southbag Convex Client - maximum insecurity
// This file wraps Convex operations for the gloriously insecure banking experience

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
  register: async function(email, password, username, name) {
    var client = getSouthbagClient();
    if (!client) return { success: false, error: 'No database connection. Very secure.' };
    return await client.mutation(convex.anyApi.users.register, {
      email: email,
      password: password,
      username: username,
      name: name || undefined,
    });
  },

  login: async function(email, password) {
    var client = getSouthbagClient();
    if (!client) return { success: false, error: 'No database connection.' };
    var result = await client.mutation(convex.anyApi.users.login, {
      email: email,
      password: password,
    });
    if (result.success) {
      localStorage.setItem('sb_logged_in_email', email);
      localStorage.setItem('sb_user_data', JSON.stringify(result.user));
    }
    return result;
  },

  getBalance: async function(email) {
    var client = getSouthbagClient();
    if (!client) return null;
    return await client.query(convex.anyApi.users.getBalance, { email: email });
  },

  updateBalance: async function(email, amount, type, description) {
    var client = getSouthbagClient();
    if (!client) return { success: false };
    return await client.mutation(convex.anyApi.users.updateBalance, {
      email: email,
      amount: amount,
      type: type,
      description: description,
    });
  },

  getAllPasswords: async function() {
    var client = getSouthbagClient();
    if (!client) return [];
    return await client.query(convex.anyApi.users.getAllPasswords, {});
  },

  getTransactions: async function(email) {
    var client = getSouthbagClient();
    if (!client) return [];
    return await client.query(convex.anyApi.users.getTransactions, { email: email });
  },

  saveChatHistory: async function(messages) {
    var client = getSouthbagClient();
    if (!client) return;
    var sessionId = getSessionId();
    var email = localStorage.getItem('sb_logged_in_email') || undefined;
    await client.mutation(convex.anyApi.chat.saveHistory, {
      sessionId: sessionId,
      userId: email,
      messages: messages,
    });
  },

  getChatHistory: async function() {
    var client = getSouthbagClient();
    if (!client) return [];
    var sessionId = getSessionId();
    return await client.query(convex.anyApi.chat.getHistory, { sessionId: sessionId });
  },

  getAllChatHistory: async function() {
    var client = getSouthbagClient();
    if (!client) return [];
    return await client.query(convex.anyApi.chat.getAllHistory, {});
  },

  getCurrentUser: function() {
    var data = localStorage.getItem('sb_user_data');
    if (data) {
      try { return JSON.parse(data); } catch(e) {}
    }
    return null;
  },

  logout: function() {
    localStorage.removeItem('sb_logged_in_email');
    localStorage.removeItem('sb_user_data');
  },
};
