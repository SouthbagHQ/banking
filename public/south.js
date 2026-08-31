const southMoney = cents => '$' + (Number(cents || 0) / 100).toFixed(2);

async function southRequest(body) {
  const response = await fetch('/api/economy', {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401) return location.href = '/auth/login';
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || data.text || 'Southbag broke');
  return data;
}

function southLog(text) {
  const panel = document.getElementById('southResult');
  if (!panel) return alert(text);
  panel.textContent = text;
  panel.scrollTop = 0;
}

async function southAction(action, extra = {}) {
  try {
    const result = await southRequest({ action, ...extra });
    southLog(result.text || JSON.stringify(result));
    if (result.account || result.ok) await loadAccount().catch(() => {});
    await southRefresh().catch(() => {});
    return result;
  } catch (error) {
    southLog(error.message);
  }
}

function southPrompt(action, fields, args = {}) {
  const extra = { ...args };
  for (const field of fields) {
    const value = prompt(field.label);
    if (value == null || value === '') return;
    extra[field.key] = value;
  }
  return southAction(action, extra);
}

async function southRefresh() {
  const data = await southRequest();
  const status = document.getElementById('southStatus');
  if (status && data.account) {
    status.textContent = `Account ${data.account.accountNumber} · ${southMoney(data.account.balance)} · ${data.account.status} · tier ${data.account.tier}`;
  }
  const shop = document.getElementById('southShop');
  if (shop && data.shop && !shop.dataset.ready) {
    shop.dataset.ready = '1';
    Object.entries(data.shop).forEach(([id, item]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = Math.random() < 0.5 ? 'btn-large' : 'btn-small';
      button.textContent = `Buy ${item.name} (${southMoney(item.price)})`;
      button.title = item.description;
      button.addEventListener('click', () => southAction('shop', { item: id }));
      shop.appendChild(button);
    });
  }
}

document.getElementById('southCommandForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('southCommand');
  const command = input.value.trim();
  if (!command) return;
  input.value = '';
  try {
    const result = await southRequest({ command });
    southLog(result.text || JSON.stringify(result));
    await loadAccount().catch(() => {});
    await southRefresh().catch(() => {});
  } catch (error) {
    southLog(error.message);
  }
});

document.querySelectorAll('[data-south]').forEach(button => {
  button.addEventListener('click', () => {
    const action = button.getAttribute('data-south');
    const fields = JSON.parse(button.getAttribute('data-south-fields') || '[]');
    const args = JSON.parse(button.getAttribute('data-south-args') || '{}');
    if (fields.length) return southPrompt(action, fields, args);
    return southAction(action, args);
  });
});

southRefresh().catch(error => southLog(error.message));
