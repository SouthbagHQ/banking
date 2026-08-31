const money = cents => '$' + (Number(cents || 0) / 100).toFixed(2);
const roundCents = value => Math.round(Number(value) || 0);
const dollarsToCents = value => roundCents(Number(value) * 100);
const now = () => Date.now();
const pick = list => list[Math.floor(Math.random() * list.length)];
const WEB_HEIST = 'web:lobby';

export const JOBS = [
  { title: 'Southbag Branch Greeter', salary: 15000 },
  { title: 'ATM Apology Writer', salary: 22000 },
  { title: 'Fee Explanation Specialist', salary: 8000 },
  { title: 'Complaint Ignorer', salary: 18000 },
  { title: 'Password Reset Denier', salary: 45000 },
  { title: 'Queue Extension Coordinator', salary: 20000 },
  { title: 'Hold Music DJ', salary: 90000 },
  { title: 'Overdraft Celebration Planner', salary: 12000 },
  { title: 'Terms & Conditions Lengthener', salary: 17500 },
  { title: 'Customer Disappointment Analyst', salary: 9000 },
  { title: 'Lobby Floor Starer', salary: 5000 },
  { title: 'Senior Vice President of Nothing', salary: 500000 },
  { title: 'Chief Vibes Officer', salary: 180000 },
  { title: 'Intern (Unpaid)', salary: 5 },
  { title: 'Executive Paper Shredder', salary: 13000 },
  { title: 'Vibe Coder', salary: 60000 },
  { title: 'Blockchain Hallucination Engineer', salary: 250000 },
  { title: 'Chief Apology Officer', salary: 320000 },
  { title: 'Compliance Loophole Finder', salary: 140000 },
  { title: 'Meeting About Meetings Coordinator', salary: 75000 },
  { title: 'Synergy Evangelist', salary: 110000 },
  { title: 'Printer Jam Therapist', salary: 30000 },
  { title: "Kevin's Personal Assistant", salary: 450000 },
  { title: 'Nap Room Security Guard', salary: 40000 },
  { title: 'Email Signature Designer', salary: 65000 },
  { title: 'Office Plant Whisperer', salary: 20000 },
];

export const SHOP_ITEMS = {
  blahaj: { name: 'Blahaj', price: 4999, description: 'An IKEA shark. Southbag Support hates this. Buy it anyway.' },
  fee_insurance: { name: 'Fee Insurance', price: 9999, description: 'Covers your next fee. Probably. No guarantees.' },
  kevins_briefcase: { name: "Kevin's Briefcase", price: 25000, description: 'Contents unknown. Kevin is watching.' },
  kevins_arm: { name: "Kevin's Arm", price: 1000000, description: 'Not a replica. HR says not to ask which one.' },
  kevins_blahaj: { name: "Kevin's Blahaj", price: 66666, description: 'Forbidden shark. Tiny tie included. Kevin denies ownership.' },
  kevins_left_sock: { name: "Kevin's Left Sock", price: 1300, description: 'Still warm. This raises several compliance concerns.' },
  kevins_spare_glasses: { name: "Kevin's Spare Glasses", price: 32000, description: 'Looking through them makes every spreadsheet say your name.' },
  kevins_lunch: { name: "Kevin's Lunch", price: 4700, description: 'A sealed container labelled DO NOT PERCEIVE.' },
  kevins_shadow: { name: "Kevin's Shadow", price: 125000, description: 'Folded badly. Moves when fluorescent lights flicker.' },
  kevin_detector: { name: 'Kevin Detector', price: 2999, description: 'Beeps constantly. Either broken or extremely accurate.' },
  kevin_repellent: { name: 'Kevin Repellent', price: 8900, description: 'Aerosol can. Smells like policy breach and lemon.' },
  prohibited_shark_permit: { name: 'Prohibited Shark Permit', price: 14000, description: 'Authorises one shark. Explicitly not valid for Blahaj.' },
  southbag_loyalty_card: { name: 'Southbag Loyalty Card', price: 1999, description: 'Every tenth fee is still charged. Loyalty matters.' },
  office_air_sample: { name: 'Office Air Sample', price: 75, description: "Bagged near Kevin's door. Contains 12% dread by volume." },
  compliance_rock: { name: 'Compliance Rock', price: 420, description: 'Painted grey. Passed three audits by remaining silent.' },
  office_light_bulb: { name: 'Office Light Bulb', price: 500, description: 'For the flickering light. You know the one.' },
  incident_report: { name: '2019 Incident Report', price: 50000, description: 'Redacted. All of it. Worth every cent.' },
  southbag_mug: { name: 'Southbag Mug', price: 1250, description: "Says 'I survived Southbag Support'. The handle is broken." },
  kevins_parking_spot: { name: "Kevin's Parking Spot", price: 100000, description: "He doesn't know you have this. Yet." },
  kevins_stapler: { name: "Kevin's Stapler", price: 1500, description: 'Red. Do not touch. Kevin knows.' },
  break_room_key: { name: 'Break Room Key', price: 7500, description: 'The break room has been locked since 2019.' },
  employee_handbook: { name: 'Employee Handbook', price: 300, description: '400 pages. All of them say "don\'t".' },
  office_plant: { name: 'Office Plant', price: 2500, description: "It's fake. Everything here is fake." },
  motivational_poster: { name: 'Motivational Poster', price: 800, description: '"Hang in there" but the cat fell off years ago.' },
  kevins_voicemail: { name: "Kevin's Voicemail", price: 15000, description: '47 seconds of breathing and then "I know."' },
  fire_extinguisher: { name: 'Fire Extinguisher', price: 4000, description: 'Expired in 2017. Decorative.' },
  parking_cone: { name: 'Parking Cone', price: 200, description: "From the parking lot. Kevin's been looking for it." },
  server_rack_dust: { name: 'Server Rack Dust', price: 50, description: 'A small bag of dust from the server room. Vintage 2019.' },
  complaint_form: { name: 'Complaint Form', price: 1000, description: 'Pre-filled with "denied". Saves time.' },
  kevins_tie: { name: "Kevin's Tie", price: 20000, description: 'He wore this to the 2019 holiday party. It has a stain.' },
  ceiling_tile: { name: 'Ceiling Tile', price: 100, description: "There's something written on the back. You can't read it." },
  security_badge: { name: 'Expired Security Badge', price: 3500, description: 'Opens nothing. But it beeps.' },
  fluorescent_tube: { name: 'Fluorescent Tube', price: 750, description: 'Buzzes at a frequency that causes mild existential dread.' },
  kevins_chair: { name: "Kevin's Office Chair", price: 200000, description: 'Ergonomic. Heated. Sentient.' },
  kevins_password: { name: "Kevin's Password", price: 500000, description: "Written on a sticky note. You shouldn't have this." },
  water_cooler: { name: 'Water Cooler', price: 3000, description: 'The one where rumours are born. Empty.' },
  exit_sign: { name: 'Exit Sign', price: 1800, description: 'It points the wrong way. Always has.' },
  kevins_family_photo: { name: "Kevin's Family Photo", price: 35000, description: "The frame is empty. Kevin says it's not." },
  broken_clock: { name: 'Broken Clock', price: 600, description: 'Stopped at 2:19 AM. The same time as the incident.' },
  sticky_notes: { name: 'Sticky Notes (Used)', price: 25, description: 'Someone wrote "HELP" on all of them. In Kevin\'s handwriting.' },
  office_key_card: { name: 'Office Key Card (Floor 3)', price: 50000, description: 'There is no Floor 3. The elevator disagrees.' },
  paper_shredder: { name: 'Paper Shredder', price: 4500, description: 'Only shreds important documents.' },
  kevins_coffee_mug: { name: "Kevin's Coffee Mug", price: 8500, description: 'Always full. Always cold. Nobody refills it.' },
  whiteboard_marker: { name: 'Whiteboard Marker (Red)', price: 400, description: "Writes in a colour that doesn't exist." },
  desk_drawer_contents: { name: 'Desk Drawer Contents', price: 2000, description: 'A sealed bag. Rattles. Do not open before 2027.' },
  visitor_badge: { name: 'Visitor Badge (Permanent)', price: 6000, description: 'Expiry date is "never". You live here now.' },
  network_cable: { name: 'Network Cable', price: 1100, description: 'Connected to something. Unplugging it causes screaming.' },
  kevins_nameplate: { name: "Kevin's Nameplate", price: 75000, description: "The name changes depending on who's reading it." },
  emergency_manual: { name: 'Emergency Manual', price: 10000, description: "Step 1: Don't panic. Step 2: Panic. Step 3: See Kevin." },
};

const COMBOS = {
  'blahaj+kevins_stapler': { resultId: 'combo:weaponised_blahaj', resultName: 'Weaponised Blahaj', description: 'A shark with a stapler for a fin.', support: 'Ow. That shark had a stapler on it. [FEE:0.50:Assault with a modified marine animal]' },
  'blahaj+fire_extinguisher': { resultId: 'combo:foam_shark', resultName: 'Foam Shark', description: 'A shark that sprays expired foam.', support: 'I am covered in foam. And shark. [FEE:2.00:Property damage via foam shark]' },
  'complaint_form+kevins_stapler': { resultId: 'combo:stapled_complaint', resultName: 'Stapled Complaint', description: 'A complaint form stapled shut. Permanently.', support: 'Denied, obviously. But impressive. [FEE:1.00:Complaint processing fee (denied)]' },
  'incident_report+kevins_briefcase': { resultId: 'combo:2019_dossier', resultName: 'The Full 2019 Dossier', description: 'You should not have done this.', support: 'NO. Close it. CLOSE IT. [FEE:25.00:Classified information exposure fee]' },
  'kevins_briefcase+kevins_tie': { resultId: 'combo:kevin_kit', resultName: "Kevin's Full Kit", description: 'You are becoming Kevin. Stop.', support: 'That is Kevin\'s tie and briefcase. Together. I need to leave. [FEE:10.00:Kevin proximity surcharge]' },
  'kevins_password+paper_shredder': { resultId: 'combo:shredded_secrets', resultName: 'Shredded Secrets', description: 'The shredder remembered.', support: 'It was never the real password. Oh no. [FEE:50.00:Security breach investigation fee]' },
  'broken_clock+fluorescent_tube': { resultId: 'combo:time_disruptor', resultName: 'Time Disruptor', description: 'It buzzes at 2:19 AM regardless of the actual time.', support: 'My system clock says 2:19. Was it ever not 2019? [FEE:4.00:Temporal displacement fee]' },
  'office_key_card+security_badge': { resultId: 'combo:all_access', resultName: 'All-Access Pass', description: 'Especially Floor 3.', support: 'THERE IS NO FLOOR 3. [FEE:20.00:Restricted access violation fee]' },
};

const MYSTERY_FEES = [
  'Existing fee', 'Fee for having a fee', 'Loyalty penalty', 'Inactivity fee (you blinked)',
  'Oxygen consumption tax', 'Monday fee', 'Vibes assessment', "Kevin's lunch fund",
  'The 2019 fee (do not ask)', 'Breathing-while-banking fee', 'Gravity usage charge',
  'Suspicion of happiness tax', 'Fee for not having more fees', 'Account hydration surcharge',
];

const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Obsidian'];
const TIER_COSTS = [10, 25, 50, 100, 200, 500];
const INSURANCE = {
  basic: { name: 'Basic (covers nothing)', premium: 10, duration: 3600000 },
  silver: { name: 'Silver (covers almost nothing)', premium: 25, duration: 14400000 },
  gold: { name: 'Gold (still covers nothing)', premium: 50, duration: 86400000 },
};
const COINS = {
  SBAG: { name: 'SouthCoin', base: 100, volatility: 0.8 },
  FEES: { name: 'FeeCoin', base: 50, volatility: 0.6 },
  SCAM: { name: 'ScamToken', base: 10, volatility: 0.95 },
  HODL: { name: 'HODLcoin', base: 200, volatility: 0.4 },
  RUG: { name: 'RugPull', base: 500, volatility: 0.99 },
};
const SLOT_SYMBOLS = ['LEMON', 'CHERRY', 'MONEY', 'DIAMOND', 'SKULL', 'BANK', 'DOWN'];
const DENIALS = [
  'Pre-existing condition', 'Act of Southbag', 'Insufficient documentation',
  'Claim filed on a day ending in Y', 'Force majeure (we do not feel like it)',
];

function coinPrice(coin) {
  const price = coin.base * (1 + Math.sin(Date.now() / 60000 * coin.volatility) * coin.volatility + (Math.random() - 0.5) * coin.volatility * 0.5);
  return Math.max(1, roundCents(price));
}

function comboKey(a, b) {
  return [a, b].sort().join('+');
}

function accountNumber() {
  return [Math.floor(Math.random() * 9000 + 1000), 'SBAG', Math.floor(Math.random() * 90000 + 10000), String.fromCharCode(65 + Math.floor(Math.random() * 26))].join('-');
}

function parseInventory(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function frozen(account) {
  return account?.status === 'frozen' ? fail('frozen', 'Your account is frozen. Kevin initialled the form.') : null;
}

function fail(error, text, extra = {}) {
  return { ok: false, error, text, ...extra };
}

function ok(text, extra = {}) {
  return { ok: true, text, ...extra };
}

async function charge(repo, account, amount, kind, description) {
  const balance = account.balance - amount;
  await repo.updateAccount(account.user_id, { balance, updated_at: now(), last_fee_at: now() });
  await repo.addTxn({ user_id: account.user_id, amount: -amount, kind, description, created_at: now() });
  account.balance = balance;
  return balance;
}

async function credit(repo, account, amount, kind, description) {
  const balance = account.balance + amount;
  await repo.updateAccount(account.user_id, { balance, updated_at: now() });
  await repo.addTxn({ user_id: account.user_id, amount, kind, description, created_at: now() });
  account.balance = balance;
  return balance;
}

async function needAccount(repo, userId) {
  const account = await repo.getAccount(userId);
  if (!account) return [null, fail('no_account', 'No account. How did you even log in.')];
  if (!account.account_number) {
    await repo.updateAccount(userId, { account_number: accountNumber(), status: account.status || 'active' });
    account.account_number = (await repo.getAccount(userId)).account_number;
  }
  account.inventory = parseInventory(account.inventory);
  return [account, null];
}

async function resolveUser(repo, hint) {
  if (!hint) return null;
  const cleaned = String(hint).replace(/^<@/, '').replace(/>$/, '').replace(/^@/, '').trim();
  return repo.findUser(cleaned);
}

export function parseCommand(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^\/south-([a-z-]+)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { action: match[1].toLowerCase(), text: (match[2] || '').trim() };
}

export function createMemoryRepo() {
  const users = new Map();
  const accounts = new Map();
  const transactions = [];
  const jobs = new Map();
  const loans = [];
  const insurance = new Map();
  const crypto = [];
  const heists = [];
  const investments = [];
  const lotteries = [];
  const tickets = [];
  let next = 1;
  const id = () => next++;
  return {
    seedUser(user) { users.set(user.id, { ...user }); },
    async getUser(userId) { return users.get(userId) || null; },
    async findUser(hint) {
      const lower = hint.toLowerCase();
      for (const user of users.values()) {
        if (user.id === hint || (user.email && user.email.toLowerCase() === lower)) return user;
      }
      return null;
    },
    async getAccount(userId) {
      const account = accounts.get(userId);
      return account ? { ...account, inventory: [...parseInventory(account.inventory)] } : null;
    },
    async updateAccount(userId, fields) {
      const current = accounts.get(userId) || { user_id: userId, balance: 0, updated_at: now(), inventory: [] };
      const nextAccount = { ...current, ...fields, user_id: userId };
      if (fields.inventory) nextAccount.inventory = fields.inventory;
      accounts.set(userId, nextAccount);
    },
    async listAccounts(direction, limit) {
      const rows = [...accounts.values()].sort((a, b) => direction === 'asc' ? a.balance - b.balance : b.balance - a.balance);
      return rows.slice(0, limit);
    },
    async addTxn(row) { transactions.push({ id: id(), ...row }); },
    async listTxns(userId, limit) {
      return transactions.filter(row => row.user_id === userId).sort((a, b) => b.created_at - a.created_at).slice(0, limit);
    },
    async getJob(userId) { return jobs.get(userId) || null; },
    async upsertJob(job) { jobs.set(job.user_id, { ...job }); },
    async deleteJob(userId) { jobs.delete(userId); },
    async getActiveLoan(userId) { return loans.find(row => row.user_id === userId && row.status === 'active') || null; },
    async upsertLoan(loan) {
      if (!loan.id) loan.id = id();
      const index = loans.findIndex(row => row.id === loan.id);
      if (index >= 0) loans[index] = { ...loan };
      else loans.push({ ...loan });
    },
    async getInsurance(userId) { return insurance.get(userId) || null; },
    async upsertInsurance(row) { insurance.set(row.user_id, { ...row }); },
    async listCrypto(userId) { return crypto.filter(row => row.user_id === userId).map(row => ({ ...row })); },
    async addCrypto(row) { crypto.push({ id: id(), ...row }); },
    async deleteCrypto(ids) {
      for (let i = crypto.length - 1; i >= 0; i--) if (ids.includes(crypto[i].id)) crypto.splice(i, 1);
    },
    async getRecruitingHeist() { return heists.find(row => row.channel_id === WEB_HEIST && row.status === 'recruiting') || null; },
    async upsertHeist(row) {
      if (!row.id) row.id = id();
      const index = heists.findIndex(item => item.id === row.id);
      if (index >= 0) heists[index] = { ...row, participants: [...row.participants] };
      else heists.push({ ...row, participants: [...row.participants] });
    },
    async getActiveInvestment(userId) { return investments.find(row => row.user_id === userId && row.status === 'active') || null; },
    async upsertInvestment(row) {
      if (!row.id) row.id = id();
      const index = investments.findIndex(item => item.id === row.id);
      if (index >= 0) investments[index] = { ...row };
      else investments.push({ ...row });
    },
    async getOpenLottery() { return lotteries.find(row => row.status === 'open') || null; },
    async upsertLottery(row) {
      if (!row.id) row.id = id();
      const index = lotteries.findIndex(item => item.id === row.id);
      if (index >= 0) lotteries[index] = { ...row };
      else lotteries.push({ ...row });
    },
    async addLotteryTicket(row) { tickets.push({ id: id(), ...row, numbers: [...row.numbers] }); },
    async listLotteryTickets(lotteryId, userId) {
      return tickets.filter(row => row.lottery_id === lotteryId && (!userId || row.user_id === userId));
    },
  };
}

export function createD1Repo(db) {
  const one = (sql, ...bind) => db.prepare(sql).bind(...bind).first();
  const all = async (sql, ...bind) => ((await db.prepare(sql).bind(...bind).all()).results) || [];
  const run = (sql, ...bind) => db.prepare(sql).bind(...bind).run();
  const parseAccount = row => row ? { ...row, inventory: parseInventory(row.inventory) } : null;
  const parseHeist = row => row ? { ...row, participants: parseInventory(row.participants) } : null;
  return {
    async getUser(userId) { return one('SELECT id, email, name FROM users WHERE id = ?', userId); },
    async findUser(hint) {
      return one('SELECT id, email, name FROM users WHERE id = ? OR lower(email) = lower(?)', hint, hint);
    },
    async getAccount(userId) { return parseAccount(await one('SELECT * FROM accounts WHERE user_id = ?', userId)); },
    async updateAccount(userId, fields) {
      const allowed = ['balance', 'updated_at', 'account_number', 'status', 'tier', 'inventory', 'last_daily_at', 'last_beg_at', 'last_fee_at', 'notifications', 'strikes'];
      const sets = [];
      const values = [];
      for (const key of allowed) {
        if (!(key in fields)) continue;
        sets.push(`${key} = ?`);
        values.push(key === 'inventory' ? JSON.stringify(fields.inventory || []) : fields[key]);
      }
      if (!sets.length) return;
      values.push(userId);
      await run(`UPDATE accounts SET ${sets.join(', ')} WHERE user_id = ?`, ...values);
    },
    async listAccounts(direction, limit) {
      const order = direction === 'asc' ? 'ASC' : 'DESC';
      return all(`SELECT user_id, balance, status, tier, account_number FROM accounts ORDER BY balance ${order} LIMIT ?`, limit);
    },
    async addTxn(row) {
      await run('INSERT INTO transactions (user_id, amount, kind, description, created_at) VALUES (?, ?, ?, ?, ?)',
        row.user_id, row.amount, row.kind, row.description, row.created_at);
    },
    async listTxns(userId, limit) {
      return all('SELECT id, amount, kind, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, limit);
    },
    async getJob(userId) { return one('SELECT user_id, title, salary, hired_at, last_worked_at FROM jobs WHERE user_id = ?', userId); },
    async upsertJob(job) {
      await run('INSERT INTO jobs (user_id, title, salary, hired_at, last_worked_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET title=excluded.title, salary=excluded.salary, hired_at=excluded.hired_at, last_worked_at=excluded.last_worked_at',
        job.user_id, job.title, job.salary, job.hired_at, job.last_worked_at);
    },
    async deleteJob(userId) { await run('DELETE FROM jobs WHERE user_id = ?', userId); },
    async getActiveLoan(userId) { return one("SELECT * FROM loans WHERE user_id = ? AND status = 'active'", userId); },
    async upsertLoan(loan) {
      if (loan.id) {
        await run('UPDATE loans SET principal=?, interest_rate=?, total_owed=?, taken_at=?, last_interest_at=?, status=? WHERE id=?',
          loan.principal, loan.interest_rate, loan.total_owed, loan.taken_at, loan.last_interest_at, loan.status, loan.id);
      } else {
        await run('INSERT INTO loans (user_id, principal, interest_rate, total_owed, taken_at, last_interest_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          loan.user_id, loan.principal, loan.interest_rate, loan.total_owed, loan.taken_at, loan.last_interest_at, loan.status);
      }
    },
    async getInsurance(userId) { return one('SELECT * FROM insurance WHERE user_id = ?', userId); },
    async upsertInsurance(row) {
      await run('INSERT INTO insurance (user_id, plan, premium, covered_until, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, premium=excluded.premium, covered_until=excluded.covered_until',
        row.user_id, row.plan, row.premium, row.covered_until, row.created_at);
    },
    async listCrypto(userId) { return all('SELECT * FROM crypto_holdings WHERE user_id = ?', userId); },
    async addCrypto(row) {
      await run('INSERT INTO crypto_holdings (user_id, coin, amount, bought_at, created_at) VALUES (?, ?, ?, ?, ?)',
        row.user_id, row.coin, row.amount, row.bought_at, row.created_at);
    },
    async deleteCrypto(ids) {
      for (const cryptoId of ids) await run('DELETE FROM crypto_holdings WHERE id = ?', cryptoId);
    },
    async getRecruitingHeist() {
      return parseHeist(await one("SELECT * FROM heists WHERE channel_id = ? AND status = 'recruiting'", WEB_HEIST));
    },
    async upsertHeist(row) {
      const participants = JSON.stringify(row.participants || []);
      if (row.id) {
        await run('UPDATE heists SET participants=?, status=?, completed_at=? WHERE id=?', participants, row.status, row.completed_at || null, row.id);
      } else {
        await run('INSERT INTO heists (channel_id, started_by, participants, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
          row.channel_id, row.started_by, participants, row.status, row.created_at, row.completed_at || null);
      }
    },
    async getActiveInvestment(userId) { return one("SELECT * FROM investments WHERE user_id = ? AND status = 'active'", userId); },
    async upsertInvestment(row) {
      if (row.id) await run('UPDATE investments SET status=? WHERE id=?', row.status, row.id);
      else await run('INSERT INTO investments (user_id, amount, multiplier, matures_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        row.user_id, row.amount, row.multiplier, row.matures_at, row.status, row.created_at);
    },
    async getOpenLottery() { return one("SELECT * FROM lotteries WHERE status = 'open' ORDER BY id DESC LIMIT 1"); },
    async upsertLottery(row) {
      if (row.id) await run('UPDATE lotteries SET jackpot=?, status=?, winning_numbers=?, drawn_at=? WHERE id=?',
        row.jackpot, row.status, row.winning_numbers || null, row.drawn_at || null, row.id);
      else await run('INSERT INTO lotteries (name, ticket_price, max_number, pick_count, jackpot, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        row.name, row.ticket_price, row.max_number, row.pick_count, row.jackpot, row.status, row.created_at);
    },
    async addLotteryTicket(row) {
      await run('INSERT INTO lottery_tickets (lottery_id, user_id, numbers, created_at) VALUES (?, ?, ?, ?)',
        row.lottery_id, row.user_id, JSON.stringify(row.numbers), row.created_at);
    },
    async listLotteryTickets(lotteryId, userId) {
      const rows = userId
        ? await all('SELECT * FROM lottery_tickets WHERE lottery_id = ? AND user_id = ?', lotteryId, userId)
        : await all('SELECT * FROM lottery_tickets WHERE lottery_id = ?', lotteryId);
      return rows.map(row => ({ ...row, numbers: parseInventory(row.numbers) }));
    },
  };
}

async function ensureLottery(repo) {
  let lottery = await repo.getOpenLottery();
  if (lottery) return lottery;
  await repo.upsertLottery({
    name: "Kevin's Numbers",
    ticket_price: 100,
    max_number: 20,
    pick_count: 3,
    jackpot: 500,
    status: 'open',
    created_at: now(),
  });
  return repo.getOpenLottery();
}

function loanOwed(loan) {
  const hours = (now() - loan.taken_at) / 3600000;
  return roundCents(loan.principal * Math.pow(1 + loan.interest_rate, hours));
}

async function overview(repo, user) {
  const [account, err] = await needAccount(repo, user.id);
  if (err) return err;
  const [job, loan, cover, holdings, investment, lottery, heist, txns] = await Promise.all([
    repo.getJob(user.id),
    repo.getActiveLoan(user.id),
    repo.getInsurance(user.id),
    repo.listCrypto(user.id),
    repo.getActiveInvestment(user.id),
    ensureLottery(repo),
    repo.getRecruitingHeist(),
    repo.listTxns(user.id, 12),
  ]);
  return ok('Welcome to Southbag. Where your money goes to die.', {
    user: { id: user.id, email: user.email, name: user.name },
    account: {
      accountNumber: account.account_number,
      balance: account.balance,
      status: account.status,
      tier: account.tier || 'None',
      notifications: !!account.notifications,
      inventory: account.inventory,
    },
    job,
    loan: loan ? { ...loan, owed: loanOwed(loan) } : null,
    insurance: cover,
    crypto: holdings,
    investment,
    lottery,
    heist,
    transactions: txns,
    shop: SHOP_ITEMS,
    commands: Object.keys(actions),
  });
}

const actions = {
  async overview(repo, user) { return overview(repo, user); },
  async catalog() {
    return ok('Kevin approved this catalogue. Reluctantly.', { shop: SHOP_ITEMS, jobs: JOBS.map(job => job.title), coins: Object.keys(COINS) });
  },
  async balance(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    await charge(repo, account, 5, 'fee', 'Balance inquiry fee');
    await charge(repo, account, 2, 'fee', 'Balance awareness surcharge');
    return ok(`Balance: ${money(account.balance)} (${account.status}). Checking cost ${money(7)}. Industry standard.`);
  },
  async 'open-account'(repo, user) {
    const [account] = await needAccount(repo, user.id);
    return ok(`You already have account ${account.account_number}. We do not do seconds.`);
  },
  async transactions(repo, user) {
    const txns = await repo.listTxns(user.id, 20);
    if (!txns.length) return ok('No transactions. Either you are new or we lost them.');
    const lines = txns.map(row => `${new Date(row.created_at).toISOString()}: ${row.description} (${money(row.amount)})`);
    return ok(lines.join('\n') + '\nSome transactions may be missing. Hard to say.', { transactions: txns });
  },
  async deposit(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const amount = dollarsToCents(body.amount);
    if (amount < 1) return fail('usage', 'Usage: /south-deposit <amount>');
    const actual = roundCents(amount * 0.73);
    const fee = 25;
    await credit(repo, account, actual, 'deposit', 'Deposit (adjusted for market conditions)');
    await charge(repo, account, fee, 'fee', 'Deposit convenience fee');
    return ok(`Deposited ${money(amount)}. Market conditions kept 27%. You received ${money(actual - fee)}. New balance ${money(account.balance)}.`);
  },
  async transfer(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const amount = dollarsToCents(body.amount);
    const target = await resolveUser(repo, body.target);
    if (!amount || !target) return fail('usage', 'Usage: /south-transfer <amount> <email-or-id>');
    if (target.id === user.id) return fail('self', 'You cannot transfer to yourself. We already have your money.');
    const recipient = (await needAccount(repo, target.id))[0];
    if (!recipient) return fail('no_recipient', 'They do not have a Southbag account. Tragic.');
    const fees = 50 + roundCents(amount * 0.15) + 2 + 10 + 7 + 3 + roundCents(amount * 0.03) + 15;
    const total = amount + fees;
    if (account.balance < total) return fail('insufficient', `Need ${money(total)}, have ${money(account.balance)}.`);
    await charge(repo, account, amount, 'transfer', `Transfer to ${target.email || target.id}`);
    await charge(repo, account, fees, 'fee', 'Transfer fees (15% + processing + breathing + Kevin + digital transit + existence + cross-desk + compliance theater)');
    await credit(repo, recipient, amount, 'deposit', `Transfer from ${user.email || user.id}`);
    return ok(`Sent ${money(amount)}. Fees ${money(fees)}. They got the amount. We got the rest. Balance ${money(account.balance)}.`);
  },
  async loan(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const sub = String(body.sub || body.text || '').trim().toLowerCase();
    const existing = await repo.getActiveLoan(user.id);
    if (sub === 'status') {
      if (!existing) return ok('No active loan. Lucky you.');
      const owed = loanOwed(existing);
      return ok(`Principal ${money(existing.principal)}. Owed now ${money(owed)}. Rate ${(existing.interest_rate * 100).toFixed(0)}% per hour. Repay before it spirals.`);
    }
    if (sub === 'repay') {
      if (!existing) return fail('no_loan', 'No loan to repay.');
      const owed = loanOwed(existing);
      if (account.balance < owed) return fail('insufficient', `You owe ${money(owed)} and have ${money(account.balance)}.`);
      await charge(repo, account, owed, 'withdrawal', `Loan repayment`);
      await repo.upsertLoan({ ...existing, status: 'paid', total_owed: owed });
      return ok(`Paid ${money(owed)}. Interest was the point. Balance ${money(account.balance)}.`);
    }
    if (sub === 'default') {
      if (!existing) return fail('no_loan', 'No loan to default on.');
      const owed = loanOwed(existing);
      await repo.upsertLoan({ ...existing, status: 'defaulted', total_owed: owed });
      await repo.updateAccount(user.id, { status: 'frozen' });
      await repo.addTxn({ user_id: user.id, amount: 0, kind: 'fee', description: `Loan default — account frozen (owed ${money(owed)})`, created_at: now() });
      return ok(`Defaulted on ${money(owed)}. Account frozen. Kevin has been notified.`);
    }
    const amount = dollarsToCents(body.amount || sub);
    if (amount < 10) return fail('usage', 'Usage: /south-loan <amount> | status | repay | default. Minimum $0.10. Maximum $10.');
    if (amount > 1000) return fail('max_loan', 'We only lend $10. We are a bank.');
    if (existing) return fail('existing_loan', 'You already have a loan. Repay or default.');
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const rate = Math.round((Math.random() * 0.35 + 0.15) * 100) / 100;
    await repo.upsertLoan({ user_id: user.id, principal: amount, interest_rate: rate, total_owed: amount, taken_at: now(), last_interest_at: now(), status: 'active' });
    await credit(repo, account, amount, 'deposit', `Loan disbursement (${(rate * 100).toFixed(0)}% per hour — good luck)`);
    return ok(`Approved for ${money(amount)} at ${(rate * 100).toFixed(0)}% per hour. This is a crime. Balance ${money(account.balance)}.`);
  },
  async rob(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const target = await resolveUser(repo, body.target);
    if (!target) return fail('usage', 'Usage: /south-rob <email-or-id>');
    if (target.id === user.id) return fail('self_rob', 'You cannot rob yourself. That is just banking.');
    const victim = (await needAccount(repo, target.id))[0];
    if (!victim) return fail('no_victim', 'They have nothing. Not even an account.');
    if (Math.random() < 0.45) {
      const fine = roundCents(Math.random() * 150 + 50);
      await charge(repo, account, fine, 'fee', 'Attempted robbery fine');
      await repo.updateAccount(user.id, { status: 'suspicious' });
      return ok(`Caught. Fine ${money(fine)}. Status: suspicious. Crime is not a career.`);
    }
    const maxSteal = Math.min(victim.balance, 200);
    if (maxSteal <= 0) return fail('victim_broke', 'They are already broke. Have some standards.');
    const stolen = Math.max(1, roundCents(Math.random() * maxSteal * 0.5 + 1));
    const fence = roundCents(stolen * 0.30);
    await charge(repo, victim, stolen, 'withdrawal', 'Mysterious disappearance of funds');
    await credit(repo, account, stolen - fence, 'deposit', 'Found money on the ground');
    await charge(repo, account, fence, 'fee', 'Fencing fee (30%)');
    return ok(`Stole ${money(stolen)}. Southbag took ${money(fence)} for fencing. Balance ${money(account.balance)}.`);
  },
  async job(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const existing = await repo.getJob(user.id);
    if (existing) return ok(`You already work as ${existing.title}. Use /south-work or /south-quit.`);
    const listing = pick(JOBS);
    await repo.upsertJob({ user_id: user.id, title: listing.title, salary: listing.salary, hired_at: now(), last_worked_at: 0 });
    await charge(repo, account, 2 + 15 + 10 + 25, 'fee', 'Uniform, commute, desk rental, and Kevin supervision fees');
    return ok(`Hired as ${listing.title}. Salary ${money(listing.salary)} per shift before tax. Onboarding fees applied. Balance ${money(account.balance)}.`);
  },
  async work(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const job = await repo.getJob(user.id);
    if (!job) return fail('no_job', 'Unemployed. Use /south-job. We are always hiring because everyone quits.');
    if (job.last_worked_at && now() - job.last_worked_at < 30000) {
      return fail('cooldown', `Shift cooldown: ${Math.ceil((30000 - (now() - job.last_worked_at)) / 1000)}s. Rest is mandatory and unpaid.`);
    }
    const roll = Math.random();
    let pay = job.salary;
    let event = 'Completed a shift';
    if (roll < 0.03) { pay *= 5; event = 'Kevin personally approved your overtime'; }
    else if (roll < 0.10) { pay *= 2.5; event = 'Overtime bonus shift'; }
    else if (roll < 0.18) { pay *= 1.75; event = 'Performance bonus (someone noticed you exist)'; }
    else if (roll < 0.33) { pay = roundCents(pay * 0.3); event = 'Pay docked (bad attitude)'; }
    else if (roll < 0.38) {
      const fine = roundCents(Math.random() * 500 + 100);
      await repo.upsertJob({ ...job, last_worked_at: now() });
      await charge(repo, account, fine, 'fee', 'Workplace incident fine');
      return ok(`Workplace incident. Fine ${money(fine)}. Balance ${money(account.balance)}.`);
    }
    pay = roundCents(pay);
    const tax = roundCents(pay * 0.40);
    const fees = 50 + 5 + roundCents(pay * 0.02);
    const net = pay - tax - fees;
    await repo.upsertJob({ ...job, last_worked_at: now() });
    await credit(repo, account, net, 'deposit', `Salary: ${job.title} (${event})`);
    return ok(`${event}. Gross ${money(pay)}. Tax 40%. Fees ${money(fees)}. Net ${money(net)}. Balance ${money(account.balance)}.`);
  },
  async quit(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const job = await repo.getJob(user.id);
    if (!job) return fail('no_job', 'You cannot quit a job you do not have.');
    await repo.deleteJob(user.id);
    await charge(repo, account, 5, 'fee', 'Exit interview fee');
    return ok(`Quit ${job.title}. Exit interview fee applied. Freedom is a product.`);
  },
  async daily(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    if (account.last_daily_at && now() - account.last_daily_at < 86400000) {
      return fail('cooldown', 'Daily already claimed. Try again tomorrow. Or do not.');
    }
    const bonus = Math.random() < 0.08;
    const reward = roundCents((Math.random() * 9 + 1) * 100) * (bonus ? 10 : 1);
    await repo.updateAccount(user.id, { last_daily_at: now() });
    account.last_daily_at = now();
    await credit(repo, account, reward, 'deposit', bonus ? 'Daily reward (BONUS DAY)' : 'Daily reward');
    await charge(repo, account, 5, 'fee', 'Daily processing fee');
    await charge(repo, account, 2, 'fee', 'Daily click surcharge');
    return ok(`Daily ${money(reward)}${bonus ? ' BONUS DAY' : ''}. Fees ${money(7)}. Net ${money(reward - 7)}. Balance ${money(account.balance)}.`);
  },
  async beg(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    if (account.last_beg_at && now() - account.last_beg_at < 60000) return fail('cooldown', 'Begging cooldown. Dignity regenerates slowly.');
    const roll = Math.random();
    await repo.updateAccount(user.id, { last_beg_at: now() });
    if (roll < 0.45) return ok('$0.00. Southbag does not do charity.');
    if (roll < 0.95) {
      const amount = roundCents(Math.random() * (roll < 0.70 ? 4 : 15) + 1);
      await credit(repo, account, amount, 'deposit', 'Begging proceeds');
      return ok(`You scraped ${money(amount)} off the floor. Balance ${money(account.balance)}.`);
    }
    const fee = roundCents(Math.random() * 20 + 5);
    await charge(repo, account, fee, 'fee', 'Reverse charity fee');
    return ok(`Reverse beg. Charged ${money(fee)}. Never ask again.`);
  },
  async coinflip(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const amount = dollarsToCents(body.amount);
    const call = String(body.call || '').toLowerCase();
    if (amount < 1 || !['heads', 'tails'].includes(call)) return fail('usage', 'Usage: /south-coinflip <amount> <heads|tails>');
    const fee = 10;
    if (account.balance < amount + fee) return fail('insufficient', `Need ${money(amount + fee)}.`);
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = result === call;
    const net = won ? roundCents(amount * 0.8) : -amount;
    if (net >= 0) await credit(repo, account, net, 'deposit', `Coinflip won (${result})`);
    else await charge(repo, account, amount, 'withdrawal', `Coinflip lost (${result})`);
    await charge(repo, account, fee, 'fee', 'Table fee');
    return ok(`${result.toUpperCase()}. You called ${call}. ${won ? 'Paid 1.8x minus dignity.' : 'House keeps it.'} Balance ${money(account.balance)}.`);
  },
  async slots(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const amount = dollarsToCents(body.amount);
    const fee = 15;
    if (amount < 1) return fail('usage', 'Usage: /south-slots <amount>');
    if (account.balance < amount + fee) return fail('insufficient', `Need ${money(amount + fee)}.`);
    const reels = [pick(SLOT_SYMBOLS), pick(SLOT_SYMBOLS), pick(SLOT_SYMBOLS)];
    let multiplier = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) multiplier = reels[0] === 'DIAMOND' ? 10 : reels[0] === 'MONEY' ? 7 : reels[0] === 'SKULL' ? -3 : 5;
    else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) multiplier = 1.5;
    const net = multiplier < 0 ? -(amount + roundCents(amount * Math.abs(multiplier))) : multiplier > 0 ? roundCents(amount * multiplier) - amount : -amount;
    if (net >= 0) await credit(repo, account, net, 'deposit', `Slots ${reels.join(' ')}`);
    else await charge(repo, account, -net, 'withdrawal', `Slots ${reels.join(' ')}`);
    await charge(repo, account, fee, 'fee', 'Machine rental fee');
    return ok(`${reels.join(' | ')}. ${multiplier > 0 ? 'Win' : multiplier < 0 ? 'Cursed' : 'Loss'}. Balance ${money(account.balance)}.`);
  },
  async gamble(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const amount = dollarsToCents(body.amount);
    const fee = 20;
    if (amount < 1) return fail('usage', 'Usage: /south-gamble <amount>');
    if (account.balance < amount + fee) return fail('insufficient', `Need ${money(amount + fee)}.`);
    const roll = Math.random() * 100;
    const table = roll < 1 ? [15, 'JACKPOT'] : roll < 5 ? [5, 'Big win'] : roll < 15 ? [3, 'Nice win'] : roll < 35 ? [1.5, 'Small win'] : roll < 50 ? [0.9, 'Break even'] : roll < 85 ? [0, 'Loss'] : roll < 95 ? [-1, 'Double loss'] : [-2, 'Catastrophic loss'];
    const multiplier = table[0];
    const net = multiplier < 0 ? -(amount + roundCents(amount * Math.abs(multiplier))) : multiplier > 0 ? roundCents(amount * multiplier) - amount : -amount;
    if (net >= 0) await credit(repo, account, net, 'deposit', `Card game: ${table[1]}`);
    else await charge(repo, account, -net, 'withdrawal', `Card game: ${table[1]}`);
    await charge(repo, account, fee, 'fee', 'Dealer tip (mandatory)');
    return ok(`${table[1]}. Balance ${money(account.balance)}.`);
  },
  async crypto(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const sub = String(body.sub || 'prices').toLowerCase();
    if (sub === 'prices') {
      const prices = Object.fromEntries(Object.entries(COINS).map(([symbol, coin]) => [symbol, { name: coin.name, price: coinPrice(coin) }]));
      return ok(Object.entries(prices).map(([symbol, info]) => `${symbol} ${info.name}: ${money(info.price)}`).join('\n'), { prices });
    }
    if (sub === 'portfolio') {
      const holdings = await repo.listCrypto(user.id);
      if (!holdings.length) return ok('No crypto. You are missing out on losing money faster.');
      const lines = holdings.map(row => `${row.amount} ${row.coin} bought at ${money(row.bought_at)} now ${money(coinPrice(COINS[row.coin]))}`);
      return ok(lines.join('\n'), { holdings });
    }
    if (sub === 'buy') {
      const symbol = String(body.coin || '').toUpperCase();
      const coin = COINS[symbol];
      const amount = dollarsToCents(body.amount);
      if (!coin || amount < 1) return fail('usage', 'Usage: /south-crypto buy <SBAG|FEES|SCAM|HODL|RUG> <amount>');
      const fee = roundCents(amount * 0.05);
      if (account.balance < amount + fee) return fail('insufficient', `Need ${money(amount + fee)}.`);
      const price = coinPrice(coin);
      await charge(repo, account, amount, 'withdrawal', `Bought ${symbol} @ ${money(price)}`);
      await charge(repo, account, fee, 'fee', 'Blockchain convenience fee (5%)');
      await repo.addCrypto({ user_id: user.id, coin: symbol, amount: amount / price, bought_at: price, created_at: now() });
      return ok(`Bought ${symbol}. 5% convenience fee. Prices mostly go down. Balance ${money(account.balance)}.`);
    }
    if (sub === 'sell') {
      const symbol = String(body.coin || '').toUpperCase();
      const holdings = (await repo.listCrypto(user.id)).filter(row => row.coin === symbol);
      if (!holdings.length) return fail('no_holdings', 'You do not own that coin.');
      const price = coinPrice(COINS[symbol]);
      const total = holdings.reduce((sum, row) => sum + row.amount, 0);
      const gross = roundCents(total * price);
      const tax = roundCents(gross * 0.10);
      await repo.deleteCrypto(holdings.map(row => row.id));
      await credit(repo, account, gross, 'deposit', `Sold ${symbol}`);
      await charge(repo, account, tax, 'fee', 'Capital gains tax (10%)');
      return ok(`Sold ${symbol} for ${money(gross)}. Tax ${money(tax)}. Balance ${money(account.balance)}.`);
    }
    return fail('usage', 'Usage: /south-crypto prices | buy <coin> <amount> | sell <coin> | portfolio');
  },
  async upgrade(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const current = account.tier ? TIERS.indexOf(account.tier) : -1;
    if (current >= TIERS.length - 1) return fail('max_tier', `Already ${account.tier}. It still does nothing.`);
    const cost = TIER_COSTS[current + 1];
    if (account.balance < cost) return fail('insufficient', `Need ${money(cost)}.`);
    const tier = TIERS[current + 1];
    await charge(repo, account, cost, 'fee', `Account upgrade to ${tier} (does absolutely nothing)`);
    await repo.updateAccount(user.id, { tier });
    return ok(`Upgraded to ${tier}. Benefits: none. Balance ${money(account.balance)}.`);
  },
  async gift(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const target = await resolveUser(repo, body.target);
    const amount = dollarsToCents(body.amount);
    if (!target || amount < 1) return fail('usage', 'Usage: /south-gift <email-or-id> <amount>');
    if (target.id === user.id) return fail('self_gift', 'Gifting yourself is a fee in waiting.');
    const recipient = (await needAccount(repo, target.id))[0];
    if (!recipient) return fail('no_recipient', 'They have no account. Your generosity is wasted.');
    const tax = roundCents(amount * 0.20);
    if (account.balance < amount + tax) return fail('insufficient', `Need ${money(amount + tax)} including 20% generosity tax.`);
    await charge(repo, account, amount, 'transfer', `Gift to ${target.email || target.id}`);
    await charge(repo, account, tax, 'fee', 'Generosity tax (20%)');
    await credit(repo, recipient, amount, 'deposit', `Gift from ${user.email || user.id}`);
    return ok(`Gifted ${money(amount)}. Tax ${money(tax)}. Being nice costs extra.`);
  },
  async insure(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const sub = String(body.sub || 'status').toLowerCase();
    if (sub === 'status') {
      const cover = await repo.getInsurance(user.id);
      if (!cover) return ok('Uninsured. Not that insurance would help.');
      return ok(`Plan ${cover.plan}. Covered until ${new Date(cover.covered_until).toISOString()}. Claims still denied.`);
    }
    if (sub === 'buy') {
      const plan = INSURANCE[String(body.plan || '').toLowerCase()];
      if (!plan) return fail('usage', 'Usage: /south-insure buy <basic|silver|gold>');
      const fee = 3;
      if (account.balance < plan.premium + fee) return fail('insufficient', `Need ${money(plan.premium + fee)}.`);
      await charge(repo, account, plan.premium, 'withdrawal', `Insurance premium: ${plan.name}`);
      await charge(repo, account, fee, 'fee', 'Policy administration fee');
      await repo.upsertInsurance({ user_id: user.id, plan: body.plan.toLowerCase(), premium: plan.premium, covered_until: now() + plan.duration, created_at: now() });
      return ok(`Purchased ${plan.name}. It will not help. Balance ${money(account.balance)}.`);
    }
    if (sub === 'claim') {
      await charge(repo, account, 2, 'fee', 'Claim processing fee');
      return ok(`Denied: ${pick(DENIALS)}. Filing fee kept. Balance ${money(account.balance)}.`);
    }
    return fail('usage', 'Usage: /south-insure buy <plan> | claim <reason> | status');
  },
  async heist(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const sub = String(body.sub || 'start').toLowerCase();
    if (sub === 'start') {
      if (await repo.getRecruitingHeist()) return fail('heist_active', 'A heist is already recruiting. Join it.');
      await charge(repo, account, 5, 'fee', 'Heist planning fee');
      await repo.upsertHeist({ channel_id: WEB_HEIST, started_by: user.id, participants: [user.id], status: 'recruiting', created_at: now() });
      return ok('Vault heist started. Others must /south-heist join. Then you /south-heist go.');
    }
    const heist = await repo.getRecruitingHeist();
    if (sub === 'join') {
      if (!heist) return fail('no_heist', 'No heist. Start one.');
      if (heist.participants.includes(user.id)) return ok('You are already in the crew. Unfortunately.');
      await charge(repo, account, 5, 'fee', 'Heist join fee');
      heist.participants.push(user.id);
      await repo.upsertHeist(heist);
      return ok(`Joined the heist. Crew size ${heist.participants.length}. Fortune favors nobody.`);
    }
    if (sub === 'go') {
      if (!heist) return fail('no_heist', 'No heist to execute.');
      if (heist.started_by !== user.id) return fail('not_starter', 'Only the organizer can go.');
      if (heist.participants.length < 2) return fail('not_enough', 'Need more crew.');
      const success = Math.random() < Math.min(0.30 + 0.10 * heist.participants.length, 0.80);
      if (success) {
        const payout = roundCents((Math.random() * 450 + 50) * 0.75);
        const share = Math.floor(payout / heist.participants.length);
        for (const participantId of heist.participants) {
          const member = (await needAccount(repo, participantId))[0];
          if (member) await credit(repo, member, share, 'deposit', 'Heist payout');
        }
        await repo.upsertHeist({ ...heist, status: 'completed', completed_at: now() });
        return ok(`Heist succeeded. Share ${money(share)} each after insurance. Kevin is circling the parking lot.`);
      }
      for (const participantId of heist.participants) {
        const member = (await needAccount(repo, participantId))[0];
        if (member) await charge(repo, member, roundCents(Math.random() * 25 + 5), 'fee', 'Heist failure fine');
      }
      await repo.upsertHeist({ ...heist, status: 'failed', completed_at: now() });
      return ok('Heist failed. Fines issued. The vault was a broom closet.');
    }
    return fail('usage', 'Usage: /south-heist start | join | go');
  },
  async 'mystery-fee'(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const fee = roundCents(Math.random() * 49 + 1);
    const desc = pick(MYSTERY_FEES);
    await charge(repo, account, fee, 'fee', desc);
    return ok(`Charged ${money(fee)} for: ${desc}. You asked for this. Balance ${money(account.balance)}.`);
  },
  async notifs(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const nextValue = account.notifications ? 0 : 1;
    await repo.updateAccount(user.id, { notifications: nextValue });
    return ok(nextValue ? 'Notifications on. We will tell you every time we take money.' : 'Notifications off. The fees continue silently.');
  },
  async leaderboard(repo, user, body) {
    const direction = String(body.sub || 'top').toLowerCase() === 'bottom' ? 'asc' : 'desc';
    const rows = await repo.listAccounts(direction, 10);
    if (!rows.length) return ok('No accounts exist yet. Somehow.');
    const title = direction === 'asc' ? 'THE WALL OF SHAME' : 'THE LEADERBOARD (temporary)';
    const lines = rows.map((row, index) => `${index + 1}. ${row.user_id.slice(0, 8)} — ${money(row.balance)} (${row.status || 'active'})`);
    return ok(`${title}\n${lines.join('\n')}`, { rows });
  },
  async invest(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const sub = String(body.sub || '').toLowerCase();
    if (sub === 'status') {
      const investment = await repo.getActiveInvestment(user.id);
      if (!investment) return ok('No active investment. Your money is unsafe in other ways.');
      const remaining = Math.max(0, Math.ceil((investment.matures_at - now()) / 60000));
      return ok(`Invested ${money(investment.amount)}. Matures in ${remaining} minute(s). Or crashes. Hard to say.`);
    }
    if (sub === 'collect') {
      const investment = await repo.getActiveInvestment(user.id);
      if (!investment) return fail('no_investment', 'Nothing to collect.');
      if (now() < investment.matures_at) return fail('not_mature', `Wait ${Math.ceil((investment.matures_at - now()) / 60000)}m. Patience is a fee.`);
      const payout = roundCents(investment.amount * investment.multiplier);
      await repo.upsertInvestment({ ...investment, status: investment.multiplier === 0 ? 'crashed' : 'matured' });
      if (payout > 0) await credit(repo, account, payout, 'deposit', `Investment ${investment.multiplier}x`);
      return ok(`Returned ${money(payout)} at ${investment.multiplier}x. Balance ${money(account.balance)}.`);
    }
    const amount = dollarsToCents(body.amount || sub);
    if (amount < 1) return fail('usage', 'Usage: /south-invest <amount> | collect | status');
    if (await repo.getActiveInvestment(user.id)) return fail('already_invested', 'One scheme at a time.');
    if (account.balance < amount) return fail('insufficient', `Need ${money(amount)}.`);
    const fee = roundCents(amount * 0.05);
    const roll = Math.random();
    const multiplier = roll < 0.20 ? 0 : roll < 0.40 ? Math.random() * 0.5 + 0.1 : roll < 0.70 ? Math.random() * 0.5 + 1 : roll < 0.90 ? Math.random() * 1 + 1.5 : Math.random() * 1 + 2;
    await charge(repo, account, amount, 'fee', 'Investment deposit');
    await repo.upsertInvestment({ user_id: user.id, amount: amount - fee, multiplier, matures_at: now() + 3600000, status: 'active', created_at: now() });
    return ok(`Invested ${money(amount - fee)} after 5% fee. Come back in an hour. Or never. Balance ${money(account.balance)}.`);
  },
  async audit(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const target = await resolveUser(repo, body.target);
    if (!target) return fail('usage', 'Usage: /south-audit <email-or-id>');
    if (target.id === user.id) return fail('self_audit', 'You already know you are broke.');
    const victim = (await needAccount(repo, target.id))[0];
    if (!victim) return fail('no_target', 'No such customer.');
    if (account.balance < 25) return fail('insufficient', 'Audit fee is $0.25.');
    await charge(repo, account, 25, 'fee', `Audit fee (target: ${target.email || target.id})`);
    const txns = await repo.listTxns(target.id, 5);
    const lines = txns.map(row => `${row.description} ${money(row.amount)}`).join('\n') || 'none';
    return ok(`AUDIT ${target.email || target.id}\nBalance ${money(victim.balance)}\nStatus ${victim.status}\n${lines}\nPrivacy is a myth.`);
  },
  async shop(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const itemId = body.item;
    if (!itemId) {
      const listing = Object.entries(SHOP_ITEMS).map(([id, item]) => `${id}: ${item.name} ${money(item.price)}`).join('\n');
      return ok('SOUTH BAG GIFT SHOP — all sales final\n' + listing, { shop: SHOP_ITEMS });
    }
    const item = SHOP_ITEMS[itemId];
    if (!item) return fail('invalid_item', 'That is not in the catalogue. Kevin says no.');
    const frozenErr = frozen(account);
    if (frozenErr) return frozenErr;
    const qty = Math.max(1, Math.min(99, Number(body.quantity) || 1));
    const cost = item.price * qty;
    if (account.balance < cost) return fail('insufficient', `You have ${money(account.balance)}. ${item.name} costs ${money(cost)}. Have you tried not being broke?`);
    const inventory = [...account.inventory];
    for (let i = 0; i < qty; i++) inventory.push({ itemId, name: item.name, boughtAt: now() + i });
    await charge(repo, account, cost, 'withdrawal', `Shop purchase: ${item.name}${qty > 1 ? ' x' + qty : ''}`);
    await repo.updateAccount(user.id, { inventory });
    return ok(`Bought ${item.name} x${qty} for ${money(cost)}. All sales final. Balance ${money(account.balance)}.`);
  },
  async inventory(repo, user) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    if (!account.inventory.length) return ok('Inventory empty. Just like your prospects.');
    return ok(account.inventory.map(item => item.name).join(', '), { inventory: account.inventory });
  },
  async combine(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    if (String(body.sub || body.text || '') === 'list') {
      return ok(Object.values(COMBOS).map(combo => `${combo.resultName}: ${combo.description}`).join('\n'));
    }
    const a = body.itemA;
    const b = body.itemB;
    if (!a || !b) return fail('usage', 'Usage: /south-combine <item> + <item> | list');
    const inventory = [...account.inventory];
    const indexA = inventory.findIndex(item => item.itemId === a);
    const indexB = inventory.findIndex((item, index) => item.itemId === b && index !== indexA);
    await charge(repo, account, 25, 'fee', 'Crafting fee');
    if (indexA < 0 || indexB < 0) return fail('missing_items', 'You do not own those. Failed attempt fee still applies. Wait, we charged the success fee anyway.');
    const combo = COMBOS[comboKey(a, b)];
    if (!combo) {
      await charge(repo, account, 10, 'fee', 'Failed combination fee');
      return fail('no_recipe', 'Those do not combine. Kevin shook his head. Quietly.');
    }
    inventory.splice(Math.max(indexA, indexB), 1);
    inventory.splice(Math.min(indexA, indexB), 1);
    inventory.push({ itemId: combo.resultId, name: combo.resultName, boughtAt: now() });
    await repo.updateAccount(user.id, { inventory });
    return ok(`Created ${combo.resultName}. ${combo.description} Balance ${money(account.balance)}.`);
  },
  async use(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const itemId = body.item;
    const target = String(body.target || 'support').toLowerCase();
    const index = account.inventory.findIndex(item => item.itemId === itemId);
    if (index < 0) return fail('missing_item', 'You do not have that.');
    const combo = Object.values(COMBOS).find(item => item.resultId === itemId);
    await charge(repo, account, 50, 'fee', 'Item usage fee');
    const inventory = [...account.inventory];
    inventory.splice(index, 1);
    await repo.updateAccount(user.id, { inventory });
    if (target === 'kevin') return ok('Kevin caught it. He kept it. You have made a mistake.');
    if (combo) return ok(combo.support);
    return ok('You used it. Something happened. We charged you anyway.');
  },
  async lottery(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const lottery = await ensureLottery(repo);
    const sub = String(body.sub || 'info').toLowerCase();
    if (sub === 'info') return ok(`${lottery.name}. Ticket ${money(lottery.ticket_price)}. Pick ${lottery.pick_count} numbers 1-${lottery.max_number}. Jackpot ${money(lottery.jackpot)}.`);
    if (sub === 'my-tickets') {
      const mine = await repo.listLotteryTickets(lottery.id, user.id);
      if (!mine.length) return ok('No tickets. The house prefers it that way.');
      return ok(mine.map(row => row.numbers.join(', ')).join('\n'));
    }
    if (sub === 'buy') {
      const numbers = (body.numbers || []).map(Number);
      if (numbers.length !== lottery.pick_count) return fail('usage', `Pick ${lottery.pick_count} numbers from 1-${lottery.max_number}.`);
      if (numbers.some(n => n < 1 || n > lottery.max_number) || new Set(numbers).size !== numbers.length) return fail('invalid_numbers', 'Invalid numbers.');
      if (account.balance < lottery.ticket_price) return fail('insufficient', `Ticket is ${money(lottery.ticket_price)}.`);
      await charge(repo, account, lottery.ticket_price, 'fee', `Lottery ticket: ${lottery.name}`);
      await repo.addLotteryTicket({ lottery_id: lottery.id, user_id: user.id, numbers, created_at: now() });
      lottery.jackpot += lottery.ticket_price;
      await repo.upsertLottery(lottery);
      if (Math.random() < 0.08) {
        const winning = [];
        while (winning.length < lottery.pick_count) {
          const n = Math.floor(Math.random() * lottery.max_number) + 1;
          if (!winning.includes(n)) winning.push(n);
        }
        const tickets = await repo.listLotteryTickets(lottery.id);
        const winner = tickets.find(ticket => ticket.numbers.slice().sort().join() === winning.slice().sort().join());
        lottery.status = 'drawn';
        lottery.winning_numbers = JSON.stringify(winning);
        lottery.drawn_at = now();
        await repo.upsertLottery(lottery);
        if (winner && winner.user_id === user.id) {
          await credit(repo, account, lottery.jackpot, 'deposit', 'Lottery jackpot (Kevin is reviewing this)');
          return ok(`JACKPOT. Numbers ${winning.join(', ')}. Paid ${money(lottery.jackpot)}. Kevin is in the parking lot.`);
        }
        return ok(`Drawn. Winning numbers ${winning.join(', ')}. Not you. Jackpot remains theoretically conceptual.`);
      }
      return ok(`Ticket purchased: ${numbers.join(', ')}. Jackpot ${money(lottery.jackpot)}. May the odds be ever in Kevin's favor.`);
    }
    return fail('usage', 'Usage: /south-lottery info | buy | my-tickets');
  },
  async fee(repo, user, body) {
    const [account, err] = await needAccount(repo, user.id);
    if (err) return err;
    const amount = Math.min(Math.max(dollarsToCents(body.amount || 0.01), 1), 10000000);
    const reason = String(body.reason || 'Unspecified Southbag fee').slice(0, 200);
    await charge(repo, account, amount, 'fee', reason);
    return ok(`Charged ${money(amount)} for: ${reason}. New balance ${money(account.balance)}.`, { balance: account.balance });
  },
};

function parseBody(action, body) {
  const text = String(body.text || '').trim();
  const parts = text.split(/\s+/).filter(Boolean);
  if (['transfer', 'gift', 'deposit', 'slots', 'gamble', 'invest', 'loan'].includes(action) && body.amount == null && parts[0]) body.amount = parts[0];
  if (action === 'transfer' && !body.target) body.target = parts[1];
  if (action === 'gift' && !body.target) { body.target = parts[0]; body.amount = parts[1]; }
  if (action === 'rob' || action === 'audit') body.target = body.target || parts[0];
  if (action === 'coinflip') { body.amount = body.amount || parts[0]; body.call = body.call || parts[1]; }
  if (action === 'crypto') {
    body.sub = body.sub || parts[0] || 'prices';
    body.coin = body.coin || parts[1];
    body.amount = body.amount || parts[2];
  }
  if (action === 'insure') { body.sub = body.sub || parts[0] || 'status'; body.plan = body.plan || parts[1]; }
  if (action === 'heist') body.sub = body.sub || parts[0] || 'start';
  if (action === 'loan') body.sub = body.sub || text;
  if (action === 'invest') body.sub = body.sub || parts[0];
  if (action === 'leaderboard') body.sub = body.sub || parts[0] || 'top';
  if (action === 'shop') { body.item = body.item || (parts[0] === 'buy' ? parts[1] : parts[0]); body.quantity = body.quantity || (parts[0] === 'buy' ? parts[2] : parts[1]); }
  if (action === 'combine') {
    body.sub = body.sub || parts[0];
    const plus = text.split('+').map(part => part.replace(/^combine\s+/i, '').trim());
    if (plus.length === 2) { body.itemA = plus[0].split(/\s+/).pop(); body.itemB = plus[1].split(/\s+/).shift(); }
  }
  if (action === 'use') { body.item = body.item || parts[0]; body.target = body.target || parts[2] || parts[1]; }
  if (action === 'lottery') {
    if (!body.sub) body.sub = ['info', 'buy', 'my-tickets'].includes((parts[0] || '').toLowerCase()) ? parts[0].toLowerCase() : 'info';
    const numberParts = (parts[0] && ['info', 'buy', 'my-tickets'].includes(parts[0].toLowerCase())) ? parts.slice(1) : parts;
    if (!body.numbers) body.numbers = numberParts.map(Number).filter(n => !Number.isNaN(n));
  }
  return body;
}

export async function handleEconomy(repo, user, body = {}) {
  await needAccount(repo, user.id);
  let action = String(body.action || '').replace(/^\/south-/, '').toLowerCase();
  if (!action && body.command) {
    const parsed = parseCommand(body.command);
    if (!parsed) return fail('usage', 'Commands start with /south- like the Slack bot. Try /south-balance.');
    action = parsed.action;
    body.text = parsed.text;
  }
  const fn = actions[action] || actions[action.replaceAll('_', '-')];
  if (!fn) return fail('unknown', `Unknown Southbag product: ${action || '(none)'}. Kevin has not approved this form.`);
  return fn(repo, user, parseBody(action, { ...body }));
}

export function bankingPrompt(snapshot) {
  const account = snapshot?.account;
  const inventory = account?.inventory?.map(item => item.name).join(', ') || 'nothing';
  return `You are Southbag Online Banking support on the website. Same vibes as the Slack bot. Be sarcastic, impatient, and a bit of a jerk. Do not use emojis. Kevin is CEO, office weather, and looming consequence. Refer to Kevin as Him.

BANKING FEATURES live on the dashboard and as /south- commands: open-account, balance (fees apply), transfer, deposit (only 73% arrives), transactions, loan (max $10, criminal interest), rob, job, work, quit, daily, beg, crypto, upgrade (does nothing), gift (20% tax), insure (claims denied), coinflip, slots, gamble, mystery-fee, shop, inventory, combine, use, lottery, heist, invest, audit, leaderboard, notifs.

You may charge fees with [FEE:amount:reason] where amount is dollars between 0.01 and 100000.

User account: ${account ? `${account.accountNumber}, ${money(account.balance)}, ${account.status}, tier ${account.tier}` : 'missing'}.
Inventory: ${inventory}.
If they own a Blahaj, be distressed. Kevin has forbidden sharks.
Do not talk about the 2019 incident.`;
}
