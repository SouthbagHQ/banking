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

const DAILY_PUNISHMENT_ACTIONS = new Set([
  'balance',
  'daily',
  'beg',
  'mystery-fee',
  'upgrade',
  'notifs',
]);

function southLog(text, useAlert = false) {
  if (useAlert) return alert(text);
  const panel = document.getElementById('southResult');
  if (!panel) return alert(text);
  panel.textContent = text;
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node) node.textContent = text;
}

async function southAction(action, extra = {}) {
  const useAlert = DAILY_PUNISHMENT_ACTIONS.has(action);
  try {
    const result = await southRequest({ action, ...extra });
    southLog(result.text || 'Kevin filed that somewhere.', useAlert);
    await loadAccount().catch(() => {});
    await southRefresh().catch(() => {});
    if (result.rows) {
      setText('southLeaderboard', result.rows.map((row, index) => `${index + 1}. ${southMoney(row.balance)} (${row.status || 'active'})`).join('\n'));
    }
    return result;
  } catch (error) {
    southLog(error.message, useAlert);
  }
}

function formPayload(form) {
  const extra = {};
  new FormData(form).forEach((value, key) => {
    extra[key] = typeof value === 'string' ? value.trim() : value;
  });
  if (form.getAttribute('data-south-form') === 'lottery') {
    extra.numbers = [extra.n1, extra.n2, extra.n3].map(Number);
    delete extra.n1;
    delete extra.n2;
    delete extra.n3;
  }
  return extra;
}

async function southRefresh() {
  const data = await southRequest();
  if (!data.account) return;
  setText('southStatus', `Account ${data.account.accountNumber} · ${southMoney(data.account.balance)} · ${data.account.status} · ${data.account.tier}`);
  setText('southAccountMeta', 'Notifications: ' + (data.account.notifications ? 'on, so we can brag about fees' : 'off, fees continue silently'));
  setText('southJob', data.job
    ? `You work as ${data.job.title} for ${southMoney(data.job.salary)} a shift before tax.`
    : 'Unemployed. We are hiring because everyone quits.');
  setText('southLoan', data.loan
    ? `Active loan. Principal ${southMoney(data.loan.principal)}. Owed about ${southMoney(data.loan.owed)}. ${(data.loan.interest_rate * 100).toFixed(0)}% per hour.`
    : 'No active loan. Maximum $10. Interest is criminal.');
  setText('southInsurance', data.insurance
    ? `Plan ${data.insurance.plan}. Covered until ${new Date(data.insurance.covered_until).toLocaleString()}. Claims still denied.`
    : 'Uninsured. Not that insurance would help.');
  setText('southInvest', data.investment
    ? `Scheme running. Matures ${new Date(data.investment.matures_at).toLocaleString()}.`
    : 'No active scheme.');
  setText('southHeist', data.heist
    ? `Heist recruiting. Crew of ${data.heist.participants.length}. Fortune favors nobody.`
    : 'No heist is recruiting. Start one and ruin a group of strangers.');
  setText('southLottery', data.lottery
    ? `${data.lottery.name}. Tickets ${southMoney(data.lottery.ticket_price)}. Jackpot ${southMoney(data.lottery.jackpot)}. Pick ${data.lottery.pick_count} numbers from 1-${data.lottery.max_number}.`
    : 'Kevin postponed the draw.');
  setText('southInventory', data.account.inventory.length
    ? data.account.inventory.map(item => item.name).join(', ')
    : 'Nothing. Just like your prospects.');
  setText('southCrypto', data.crypto.length
    ? data.crypto.map(row => `${row.amount.toFixed ? row.amount.toFixed(4) : row.amount} ${row.coin}`).join(' · ')
    : 'No coins. You are missing out on losing money faster.');
  if (data.leaderboard) {
    setText('southLeaderboard', data.leaderboard.map((row, index) => `${index + 1}. ${southMoney(row.balance)} (${row.status || 'active'})`).join('\n'));
  }

  const shop = document.getElementById('southShop');
  if (shop && data.shop && !shop.dataset.ready) {
    shop.dataset.ready = '1';
    Object.entries(data.shop).forEach(([id, item]) => {
      const card = document.createElement('div');
      card.className = 'south-item';
      const heading = document.createElement('strong');
      heading.textContent = item.name;
      const price = document.createElement('span');
      price.textContent = southMoney(item.price);
      const copy = document.createElement('p');
      copy.textContent = item.description;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-small';
      button.textContent = 'Buy';
      button.addEventListener('click', () => southAction('shop', { item: id }));
      card.append(heading, price, copy, button);
      shop.appendChild(card);
    });
  }
}

document.querySelectorAll('[data-south]').forEach(button => {
  button.addEventListener('click', () => {
    southAction(button.getAttribute('data-south'), JSON.parse(button.getAttribute('data-south-args') || '{}'));
  });
});

document.querySelectorAll('[data-south-form]').forEach(form => {
  form.addEventListener('submit', event => {
    event.preventDefault();
    southAction(form.getAttribute('data-south-form'), formPayload(form));
  });
});

southRefresh().catch(error => southLog(error.message));
