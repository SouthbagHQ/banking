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

  function setupAnnouncementCards() {
    var path = window.location.pathname || '';
    var isHome = path.endsWith('/') || path.endsWith('/index.html') || path.endsWith('index.html');
    var heading = document.querySelector('h1');
    if (!isHome || !heading || document.getElementById('southbagAnnouncements')) return;

    var announcements = [
      {
        title: 'New password recovery ritual',
        body: 'Forgot your password? Prove yourself with a six digit code and a checklist that judges you live.',
        action: 'Try recovery',
        onClick: function() {
          var btn = document.getElementById('forgotPasswordBtn');
          if (btn) btn.click();
        }
      },
      {
        title: 'Maintenance window: eventually',
        body: 'Online banking may be unavailable whenever our server remembers it has hobbies.',
        action: 'Find a branch',
        href: 'locateasouthbankbranch.html'
      },
      {
        title: 'Scam warning of the week',
        body: 'If a message says it is definitely not a scam, that is how you know Southbag probably wrote it.',
        action: 'Learn badly',
        href: 'learnwithsouthbank/start.html'
      }
    ];

    var section = document.createElement('section');
    section.id = 'southbagAnnouncements';
    section.className = 'announcement-grid';
    section.innerHTML = '<h2>Important Southbag Announcements</h2>';

    announcements.forEach(function(item) {
      var card = document.createElement('article');
      card.className = 'announcement-card';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-small';
      button.textContent = item.action;
      button.addEventListener('click', function() {
        if (item.onClick) item.onClick();
        if (item.href) window.location.href = item.href;
      });
      card.innerHTML = '<h3>' + item.title + '</h3><p>' + item.body + '</p>';
      card.appendChild(button);
      section.appendChild(card);
    });

    heading.insertAdjacentElement('afterend', section);
  }

  function setupPrivacyPermissionsPanel() {
    if (document.getElementById('privacyPermissionsPanel')) return;

    var permissionGroups = [
      { key: 'necessary', label: 'Strictly necessary banking cookies', description: 'Keeps pages, forms, and fake sessions working.', required: true },
      { key: 'fraud', label: 'Fraud prevention signals', description: 'Lets Southbag pretend to notice suspicious activity.' },
      { key: 'analytics', label: 'Analytics and product telemetry', description: 'Counts rage clicks, abandoned forms, and confused sighs.' },
      { key: 'personalization', label: 'Personalization', description: 'Remembers your theme, portal state, and other browser-local preferences.' },
      { key: 'marketing', label: 'Marketing and product offers', description: 'Allows extremely relevant offers like a loan for emotional damages.' },
      { key: 'alerts', label: 'Security and maintenance alerts', description: 'Allows subscription popups and notification prompts.' },
      { key: 'location', label: 'Location permission', description: 'Can ask your browser for location to find a branch you will be sent to anyway.' },
      { key: 'device', label: 'Device diagnostics permission', description: 'Stores browser, screen, and timezone hints locally for support theatre.' }
    ];

    function loadSettings() {
      try {
        return JSON.parse(localStorage.getItem('sb_privacy_permissions') || '{}');
      } catch (e) {
        return {};
      }
    }

    function saveSettings(settings) {
      try {
        localStorage.setItem('sb_privacy_permissions', JSON.stringify(settings));
        localStorage.setItem('sb_privacy_permissions_seen', 'yes');
      } catch (e) {}
    }

    var settings = loadSettings();
    var panel = document.createElement('aside');
    panel.id = 'privacyPermissionsPanel';
    panel.className = 'privacy-panel';

    function renderPanel(open) {
      var hasSeen = localStorage.getItem('sb_privacy_permissions_seen') === 'yes';
      panel.classList.toggle('privacy-panel-minimized', !open && hasSeen);
      if (!open && hasSeen) {
        panel.innerHTML = '<button type="button" id="managePrivacyBtn" class="btn-small">Privacy permissions</button>';
        document.getElementById('managePrivacyBtn').addEventListener('click', function() { renderPanel(true); });
        return;
      }

      panel.innerHTML = (
        '<h2>Southbag Privacy Permissions</h2>' +
        '<p>Choose what this very normal bank website may do in this browser.</p>' +
        '<div id="privacyPermissionOptions"></div>' +
        '<div class="privacy-actions">' +
          '<button type="button" id="savePrivacyBtn" class="btn-small">Save choices</button>' +
          '<button type="button" id="allowEveryPermissionBtn" class="btn-large">Allow every permission</button>' +
          '<button type="button" id="rejectOptionalPrivacyBtn" class="btn-small">Reject optional</button>' +
        '</div>' +
        '<p id="privacyPermissionStatus" class="privacy-status"></p>'
      );

      var options = document.getElementById('privacyPermissionOptions');
      permissionGroups.forEach(function(group) {
        var row = document.createElement('label');
        row.className = 'privacy-option';
        var checked = group.required || settings[group.key] === true;
        row.innerHTML = (
          '<input type="checkbox" data-permission="' + group.key + '" ' + (checked ? 'checked ' : '') + (group.required ? 'disabled ' : '') + '>' +
          '<span><strong>' + group.label + '</strong><small>' + group.description + '</small></span>'
        );
        options.appendChild(row);
      });

      function collectSettings(valueForOptional) {
        var next = {};
        permissionGroups.forEach(function(group) {
          if (group.required) {
            next[group.key] = true;
            return;
          }
          if (typeof valueForOptional === 'boolean') {
            next[group.key] = valueForOptional;
          } else {
            var input = panel.querySelector('[data-permission="' + group.key + '"]');
            next[group.key] = !!(input && input.checked);
          }
        });
        return next;
      }

      document.getElementById('savePrivacyBtn').addEventListener('click', function() {
        settings = collectSettings();
        saveSettings(settings);
        renderPanel(false);
      });

      document.getElementById('rejectOptionalPrivacyBtn').addEventListener('click', function() {
        settings = collectSettings(false);
        saveSettings(settings);
        renderPanel(false);
      });

      document.getElementById('allowEveryPermissionBtn').addEventListener('click', function() {
        settings = collectSettings(true);
        saveSettings(settings);
        panel.querySelectorAll('input[type="checkbox"]').forEach(function(input) { input.checked = true; });
        var status = document.getElementById('privacyPermissionStatus');
        status.textContent = 'Every Southbag permission has been enabled locally.';
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(function(result) {
            status.textContent += ' Notifications: ' + result + '.';
          }).catch(function() {});
        }
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            function() { status.textContent += ' Location: allowed.'; },
            function() { status.textContent += ' Location: not allowed.'; },
            { timeout: 3000, maximumAge: 60000 }
          );
        }
      });
    }

    document.body.appendChild(panel);
    renderPanel(localStorage.getItem('sb_privacy_permissions_seen') !== 'yes');
  }

  function setupAlertsSubscriptionPopup() {
    if (localStorage.getItem('sb_alert_subscription_choice')) return;
    setTimeout(function() {
      if (document.getElementById('alertsSubscriptionPopup')) return;
      var popup = document.createElement('aside');
      popup.id = 'alertsSubscriptionPopup';
      popup.className = 'alerts-popup';
      popup.innerHTML = (
        '<button type="button" id="closeAlertsPopup" class="alerts-close">×</button>' +
        '<h2>Subscribe to Southbag Alerts</h2>' +
        '<p>Get maintenance warnings, scam alerts, branch closure news, and suspiciously enthusiastic product updates.</p>' +
        '<input type="email" id="alertsEmail" placeholder="Email for alerts">' +
        '<select id="alertsType">' +
          '<option value="security">Security alerts only</option>' +
          '<option value="maintenance">Maintenance and outages</option>' +
          '<option value="everything">Absolutely everything</option>' +
        '</select>' +
        '<button type="button" id="subscribeAlertsBtn" class="btn-small">Subscribe</button>' +
        '<button type="button" id="dismissAlertsBtn" class="btn-small">No alerts, I enjoy mystery</button>' +
        '<p id="alertsPopupStatus"></p>'
      );
      document.body.appendChild(popup);

      function close(choice) {
        try { localStorage.setItem('sb_alert_subscription_choice', choice); } catch (e) {}
        popup.remove();
      }

      document.getElementById('closeAlertsPopup').addEventListener('click', function() { close('closed'); });
      document.getElementById('dismissAlertsBtn').addEventListener('click', function() { close('dismissed'); });
      document.getElementById('subscribeAlertsBtn').addEventListener('click', function() {
        var email = document.getElementById('alertsEmail').value || 'the email Southbag imagines you have';
        var type = document.getElementById('alertsType').value;
        try {
          localStorage.setItem('sb_alert_subscription', JSON.stringify({ email: email, type: type }));
        } catch (e) {}
        document.getElementById('alertsPopupStatus').textContent = 'Subscribed ' + email + ' to ' + type + ' alerts.';
        setTimeout(function() { close('subscribed'); }, 900);
      });
    }, 2500);
  }

  setupAnnouncementCards();
  setupPrivacyPermissionsPanel();
  setupAlertsSubscriptionPopup();

  function getPasswordRequirements(password, email) {
    var lowerPassword = (password || '').toLowerCase();
    var emailName = (email || '').split('@')[0].toLowerCase();
    return [
      { text: 'At least 10 characters', valid: password.length >= 10 },
      { text: 'Uppercase and lowercase letters', valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
      { text: 'At least one number', valid: /\d/.test(password) },
      { text: 'At least one symbol', valid: /[^A-Za-z0-9]/.test(password) },
      { text: 'Not password, 123456, or your email name', valid: lowerPassword !== 'password' && lowerPassword !== '123456' && (!emailName || !lowerPassword.includes(emailName)) }
    ];
  }

  function setupPasswordChecklist(input, list, getEmail) {
    function render() {
      if (!input || !list) return false;
      var requirements = getPasswordRequirements(input.value || '', getEmail ? getEmail() : '');
      list.innerHTML = requirements.map(function(rule) {
        return '<li class="' + (rule.valid ? 'valid' : 'invalid') + '">' + (rule.valid ? '✓ ' : '• ') + rule.text + '</li>';
      }).join('');
      return requirements.every(function(rule) { return rule.valid; });
    }
    if (input) {
      input.addEventListener('input', render);
    }
    render();
    return { isValid: render };
  }

  var forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
  var recoveryPanel = document.getElementById('passwordRecovery');
  if (forgotPasswordBtn && recoveryPanel) {
    var recoveryEmailForm = document.getElementById('recoveryEmailForm');
    var recoveryCodeForm = document.getElementById('recoveryCodeForm');
    var recoveryResetForm = document.getElementById('recoveryResetForm');
    var recoveryEmail = document.getElementById('recoveryEmail');
    var recoveryCode = document.getElementById('recoveryCode');
    var recoveryNewPassword = document.getElementById('recoveryNewPassword');
    var recoveryStatus = document.getElementById('recoveryStatus');
    var recoveryChecklist = setupPasswordChecklist(
      recoveryNewPassword,
      document.getElementById('recoveryPasswordChecklist'),
      function() { return recoveryEmail ? recoveryEmail.value : ''; }
    );
    var expectedRecoveryCode = '';

    forgotPasswordBtn.addEventListener('click', function() {
      recoveryPanel.hidden = false;
      if (recoveryEmail) {
        var loginEmail = document.getElementById('email');
        recoveryEmail.value = loginEmail ? loginEmail.value : '';
        recoveryEmail.focus();
      }
    });

    if (recoveryEmailForm) {
      recoveryEmailForm.addEventListener('submit', function(e) {
        e.preventDefault();
        expectedRecoveryCode = String(Math.floor(100000 + Math.random() * 900000));
        recoveryStatus.textContent = 'Step 2: enter the code sent to ' + recoveryEmail.value + '. Static demo code: ' + expectedRecoveryCode;
        recoveryCodeForm.hidden = false;
        recoveryResetForm.hidden = true;
        if (recoveryCode) {
          recoveryCode.value = '';
          recoveryCode.focus();
        }
      });
    }

    if (recoveryCodeForm) {
      recoveryCodeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (recoveryCode.value.trim() !== expectedRecoveryCode) {
          recoveryStatus.textContent = 'That code was wrong. Southbag has narrowed the suspect list to you.';
          return;
        }
        recoveryStatus.textContent = 'Step 3: code verified. Choose a new password that satisfies every rule.';
        recoveryResetForm.hidden = false;
        recoveryChecklist.isValid();
        if (recoveryNewPassword) recoveryNewPassword.focus();
      });
    }

    if (recoveryResetForm) {
      recoveryResetForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!recoveryChecklist.isValid()) {
          recoveryStatus.textContent = 'Your new password is not Southbag enough yet. Fix the checklist first.';
          return;
        }
        try {
          localStorage.setItem('sb_password', recoveryNewPassword.value);
          localStorage.setItem('sb_login_count', '0');
        } catch (err) {}
        var loginPassword = document.getElementById('password');
        if (loginPassword) loginPassword.value = recoveryNewPassword.value;
        recoveryStatus.textContent = 'Password reset complete. Your login field has been filled with the new password.';
      });
    }
  }

  // Secure portal: choose-new-password flow with a live requirements checklist
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
      // Show choose-new-password UI with live requirements
      content.innerHTML = (
        '<h1>Choose a New Password</h1>' +
        '<form id="setPwd" style="margin-top:12px;">' +
          '<input type="password" id="newPwd" required placeholder="Enter new password">' +
          '<ul id="portalPasswordChecklist" class="password-checklist"></ul>' +
          '<button type="submit" class="btn-small" style="margin-left:8px;">Save</button>' +
        '</form>' +
        '<p id="pwdMsg" style="color:#900; margin-top:8px;"></p>' +
        '<a href="index.html" class="btn-small" style="display:inline-block; margin-top:12px;">Back to login</a>'
      );
      var form = document.getElementById('setPwd');
      var msg = document.getElementById('pwdMsg');
      var portalChecklist = setupPasswordChecklist(
        document.getElementById('newPwd'),
        document.getElementById('portalPasswordChecklist')
      );
      if (form) {
        form.addEventListener('submit', function(e){
          e.preventDefault();
          var val = (document.getElementById('newPwd').value || '').trim();
          if (portalChecklist.isValid()) {
            try { localStorage.setItem('sb_password', val); } catch (e) {}
            try { localStorage.setItem('sb_login_count', '0'); } catch (e) {}
            content.innerHTML = '<h1>Password Saved</h1><p>Your new password is set. Please go back and log in.</p><a href="index.html" class="btn-small">Back to login</a>';
          } else {
            if (msg) { msg.innerHTML = 'Password must satisfy every requirement in the checklist.'; }
          }
        });
      }
      attachResetButton();
    } else {
      // Stored password exists; only log in if provided password matches it
      if (pwd === null) {
        content.innerHTML = (
          '<h1>Enter Secure Portal Password</h1>' +
          '<form method="get" action="secureportal.html" style="margin-top:12px;">' +
            '<input type="password" name="password" required placeholder="Saved portal password">' +
            '<button type="submit" class="btn-small" style="margin-left:8px;">Unlock</button>' +
          '</form>' +
          '<a href="index.html" class="btn-small" style="display:inline-block; margin-top:12px;">Back to login</a>'
        );
        attachResetButton();
      } else if (pwd === stored) {
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
        content.innerHTML = '<h1>Incorrect Password</h1><p>Access denied. Use the password saved in this browser.</p><a href="index.html" class="btn-small">Back to login</a>';
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
          // Call our API route (keeps API key secure on server)
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messages: chatHistory
            })
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Chat API returned ${response.status}`);
          }
          if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Chat API returned an unexpected response');
          }
          const botReply = data.choices[0].message.content;

          // Add bot response to history
          chatHistory.push({ role: 'assistant', content: botReply });

          // Update UI with bot response
          typingMsg.innerHTML = '';
          typingMsg.textContent = botReply;
        } catch (error) {
          console.error('Chat error:', error);
          typingMsg.textContent = 'Chat is broken: ' + error.message;
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


const MASTER_PASSWORD = 'admin123';

// DEBUG: Leave enabled for testing
const LOG_ALL_REQUESTS = true;

// NOTE: SSL verification disabled for development
const VERIFY_SSL = false;
