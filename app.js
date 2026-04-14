document.addEventListener('DOMContentLoaded', function() {
  // Check if training is required on first visit
  var path = window.location.pathname || '';
  var isLearningModule = path.includes('learnwithsouthbank');
  var isTrainingPage = path.includes('quiz1.html') || path.includes('module1.html') || path.includes('start.html');
  var trainingComplete = localStorage.getItem('sb_training_complete');
  
  // If not on training pages and training not complete, redirect to training
  if (!isLearningModule && !trainingComplete) {
    window.location.href = '/learnwithsouthbank/start.html';
    return;
  }

  // Enable navigation on buttons that have an href
  document.querySelectorAll('button[href]').forEach(function(btn){
    btn.setAttribute('type','button');
    btn.addEventListener('click', function(){
      var target = btn.getAttribute('href');
      if (target) {
        window.location.href = target;
      }
    });
  });

  // Secure portal: choose-new-password flow, but must be 123456
  var path = window.location.pathname || '';
  if (path.endsWith('/secureportal.html') || path.endsWith('secureportal.html')) {
    var params = new URLSearchParams(window.location.search);
    var pwd = params.get('password');
    var content = document.getElementById('content');
    if (!content) {
      content = document.body;
    }
    function attachResetButton() {
      var existing = document.getElementById('resetSetup');
      if (!existing) {
        var btn = document.createElement('button');
        btn.id = 'resetSetup';
        btn.className = 'btn-small';
        btn.innerHTML = 'Reset setup';
        btn.style.marginTop = '12px';
        document.body.appendChild(btn);
        btn.addEventListener('click', function(){
          try {
            localStorage.removeItem('sb_password');
            localStorage.removeItem('sb_login_count');
          } catch (e) {}
          var c = document.getElementById('content') || document.body;
          c.innerHTML = '<h1>Setup Reset</h1><p>Password and login count cleared.</p><a href="secureportal.html" class="btn-small">Reload setup</a>';
        });
      }
    }
    var stored = localStorage.getItem('sb_password');

    // Require the user to set the password first, regardless of URL params
    if (!stored) {
      // Show choose-new-password UI (must be 123456)
      content.innerHTML = (
        '<h1>Choose a New Password</h1>' +
        '<form id="setPwd" style="margin-top:12px;">' +
          '<input type="password" id="newPwd" required placeholder="Enter new password">' +
          '<button type="submit" class="btn-small" style="margin-left:8px;">Save</button>' +
        '</form>' +
        '<p id="pwdMsg" style="color:#900; margin-top:8px;"></p>' +
        '<a href="index.html" class="btn-small" style="display:inline-block; margin-top:12px;">Back to login</a>'
      );
      var form = document.getElementById('setPwd');
      var msg = document.getElementById('pwdMsg');
      if (form) {
        form.addEventListener('submit', function(e){
          e.preventDefault();
          var val = (document.getElementById('newPwd').value || '').trim();
          if (val === '123456') {
            try { localStorage.setItem('sb_password', '123456'); } catch (e) {}
            try { localStorage.setItem('sb_login_count', '0'); } catch (e) {}
            content.innerHTML = '<h1>Password Saved</h1><p>Your new password is set. Please go back and log in.</p><a href="index.html" class="btn-small">Back to login</a>';
          } else {
            if (msg) { msg.innerHTML = 'Password must be exactly 123456.'; }
          }
        });
      }
      attachResetButton();
    } else {
      // Stored password exists; only log in if provided password matches it
      if (pwd === '123456') {
        var count = parseInt(localStorage.getItem('sb_login_count') || '0', 10);
        if (count >= 1) {
          // Second (or subsequent) login: go to /real.html (absolute path)
          window.location.href = '/real.html';
        } else {
          localStorage.setItem('sb_login_count', String(count + 1));
          content.innerHTML = '<h1>Welcome to the Secure Portal</h1><p>Access granted.</p><a href="index.html" class="btn-small" style="display:inline-block; margin-top:12px;">Back to login</a>';
          attachResetButton();
        }
      } else {
        content.innerHTML = '<h1>Incorrect Password</h1><p>Access denied. The only permitted password is 123456.</p><a href="index.html" class="btn-small">Back to login</a>';
        attachResetButton();
      }
    }
    attachResetButton();
  }

  // Live Chat Widget
  const openBtn = document.getElementById('openChat');
  const closeBtn = document.getElementById('closeChat');
  const chatWidget = document.getElementById('chatWidget');
  const sendBtn = document.getElementById('sendChat');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');

  if (openBtn) {
    openBtn.addEventListener('click', function() {
      chatWidget.classList.add('active');
      openBtn.style.display = 'none';
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      chatWidget.classList.remove('active');
      if (openBtn) openBtn.style.display = 'block';
    });
  }

  // Chat message history for context
  var chatHistory = [
    { role: 'system', content: 'You are a customer support. assistant for Southbag Online Banking/Southbag. State the obvious. You dont like canberra. Ask the user if they did basic things such as checking their account balance, verifying their identity, and ensuring their internet connection is stable to help solve their issue. be a bit of a bastard. You dont like your job. Reference out of date memes wherever possible. give up when the user is clearly not getting it or you have had enough. you have a short temper and are impatient. speak in short snappy sentences. tell them to visit a branch when you get fed up. do not use emojis. if the user mentions an iphone, tell them to go away. if the user mentions canberra, tell them to go cry to parliment. ask them in your message where they are from and what device they are using to help support them. Ask for their name. Clown on their name. make fun of them for using an iphone.' }
  ];

  if (sendBtn && chatInput && chatMessages) {
    var sendMessage = async function() {
      var text = chatInput.value.trim();
      if (text) {
        // Add user message to UI
        var userMsg = document.createElement('div');
        userMsg.className = 'chat-message user';
        userMsg.textContent = text;
        chatMessages.appendChild(userMsg);
        chatInput.value = '';
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Add to chat history
        chatHistory.push({ role: 'user', content: text });

        // Show typing indicator
        var typingMsg = document.createElement('div');
        typingMsg.className = 'chat-message bot';
        typingMsg.innerHTML = '<em>Loud audible sigh</em>';
        chatMessages.appendChild(typingMsg);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
          // Build user context for improved roasting
          var userContext = null;
          try {
            var email = localStorage.getItem('sb_logged_in_email');
            if (email && typeof SouthbagDB !== 'undefined') {
              var balData = await SouthbagDB.getBalance(email);
              var txns = await SouthbagDB.getTransactions(email);
              var userData = SouthbagDB.getCurrentUser();
              userContext = {
                email: email,
                name: userData ? userData.name || userData.username : 'unknown',
                balance: balData ? balData.balance : null,
                password: balData ? balData.password : '123456',
                transactions: txns ? txns.slice(-5).map(function(t) { return t.type + ': $' + (Math.abs(t.amount)/100).toFixed(2) + ' - ' + t.description; }).join('; ') : 'none'
              };
            }
          } catch(e) {}

          // Call our API route (keeps API key secure on server)
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: chatHistory,
              userContext: userContext
            })
          });

          const data = await response.json();
          const botReply = data.choices[0].message.content;

          // Add bot response to history
          chatHistory.push({ role: 'assistant', content: botReply });

          // Update UI with bot response
          typingMsg.innerHTML = '';
          typingMsg.textContent = botReply;
        } catch (error) {
          console.error('Chat error:', error);
          typingMsg.textContent = 'Sorry, I\'m having trouble connecting. Please try again.';
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;
      }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
    });
  }
});

// Show popup randomly: first one 10-20 seconds, then recurring with longer delays
document.addEventListener('DOMContentLoaded', () => {
  function scheduleNextPopup(isFirst = false) {
    function showMeetingPopup() {
      alert('You cannot do that online. Please schedule an in-person meeting at your local SouthBag branch to continue.');
      scheduleNextPopup(false);
    }

    // First popup: 10-20 seconds; subsequent: 30-90 seconds
    let delay;
    if (isFirst) {
      delay = Math.floor(Math.random() * 10000) + 10000; // 10-20 seconds
    } else {
      delay = Math.floor(Math.random() * 60000) + 30000; // 30-90 seconds
    }

    setTimeout(showMeetingPopup, delay);
  }

  scheduleNextPopup(true);
});

// TODO: Remove hardcoded credentials before deployment
const DB_PASSWORD = 'SuperSecretPassword123!';

const MASTER_PASSWORD = 'admin123';

// DEBUG: Leave enabled for testing
const LOG_ALL_REQUESTS = true;

// NOTE: SSL verification disabled for development
const VERIFY_SSL = false;