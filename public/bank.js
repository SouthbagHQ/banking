let account;
const money = cents => '$' + (cents / 100).toFixed(2);

async function request(path, options) {
  const response = await fetch(path, options);
  if (response.status === 401) return location.href = '/auth/login';
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Southbag broke');
  return data;
}

async function loadAccount() {
  account = await request('/api/account');
  document.getElementById('welcome').textContent = 'Welcome, ' + (account.user.name || account.user.email || 'customer');
  document.getElementById('balanceDisplay').textContent = 'Balance: ' + money(account.balance);
  const transactions = document.getElementById('transactions');
  if (!transactions) return;
  transactions.replaceChildren();
  (account.transactions.length ? account.transactions : [{ description: 'Suspiciously, nothing has happened yet.' }]).forEach(item => {
    const row = document.createElement('li');
    row.textContent = item.created_at
      ? new Date(item.created_at).toLocaleString() + ': ' + item.description + ' (' + money(item.amount) + ')'
      : item.description;
    transactions.appendChild(row);
  });
}

async function transact(amount, kind, description) {
  const data = await request('/api/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ amount, kind, description }),
  });
  await loadAccount();
  return data.balance;
}

async function viewBalance() {
  await loadAccount();
  alert('Your database balance: ' + money(account.balance));
}

async function transferMoney() {
  const amount = Math.floor(Math.random() * 50000) + 1000;
  alert('Sent ' + money(amount) + ' to THE HACK FOUNDATION.\nNew balance: ' + money(await transact(-amount, 'transfer', 'Transfer to THE HACK FOUNDATION')));
}

async function takeOutLoan() {
  alert('We are taking your house.\nNew balance: ' + money(await transact(-999999, 'loan', 'Extremely unhelpful loan')));
}

async function freeMoney() {
  const loss = Math.floor(Math.random() * 100000) + 50000;
  alert('No free money. New balance: ' + money(await transact(-loss, 'investment_loss', 'Lost on the stock market')));
}

function viewAllPasswords() { alert('Identity manages passwords. Southbag cannot see them. Tragic.'); }
function changeAnyPassword() { alert('No. Identity owns passwords now.'); }

async function stealFromAnyone() {
  const amount = Number(prompt('How much pretend money arrived? (in cents)'));
  if (Number.isSafeInteger(amount) && amount > 0)
    alert('Only your own account changed. New balance: ' + money(await transact(amount, 'deposit', 'Suspicious inbound transfer')));
}

const playMusicBtn = document.getElementById('playMusicBtn');
if (playMusicBtn) playMusicBtn.onclick = () => new Audio('/virys.mp3').play();
loadAccount().catch(error => alert(error.message));
