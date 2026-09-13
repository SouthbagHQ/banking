import { chat } from './ai.js';
import {
  banStatus,
  banUser,
  cancelLottery,
  createD1Repo,
  createLottery,
  drawLottery,
  findCombo,
  handleEconomy,
  money,
  resolveSlackUser,
  SHOP_ITEMS,
  warnUser,
} from './economy.js';
import { bytesToBase64, createSlackClient, verifySlackRequest } from './slack-api.js';
import { executeCommands, parseCommands } from './slack-commands.js';
import { KEVIN_PROMPT, KEVIN_TRIGGER_REGEX, kevinLetterPrompt, SYSTEM_PROMPT } from './slack-prompt.js';

const DEFAULT_ALLOWED_CHANNEL = 'C0AH7GB4V6X';
const SUPPORTED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const SLACK_IMAGE_URL_FIELDS = ['thumb_1024', 'thumb_960', 'thumb_720', 'thumb_480', 'url_private_download', 'url_private'];
const MENTION = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
const WINDOW_SHOPPING_FEE = 15;
const IN_CHANNEL = new Set(['heist', 'leaderboard', 'audit']);

const FLAVOUR = {
  balance: ['Southbag Account Summary', 'Your balance was charged for checking your balance, and then charged again for knowing about it. Classic.'],
  'open-account': ['Welcome to Southbag Online Banking', 'Terms and conditions: there are none. Good luck.'],
  transfer: ['Transfer Complete (somehow)', 'The recipient received the amount. You are welcome.'],
  deposit: ['Deposit Processed', 'The 27% deposit shrinkage is a feature, not a bug.'],
  transactions: ['Transaction History', 'Some transactions may be missing. Hard to say.'],
  loan: ['Loan Desk', "Interest accrues every hour. Repay before it spirals. Or don't. We love spirals."],
  rob: ['Crime Report', 'Southbag does not condone this. But we do take a cut.'],
  job: ['Welcome to the Southbag Team', 'You were not our first choice. Or our second. Or our third.'],
  work: ['Shift Complete', 'Another day, another dollar. Minus 40% tax. Minus fees. Minus hope.'],
  quit: ['You Quit. Congratulations.', "Don't let the door hit you on the way out. Actually, do. It's funnier."],
  coinflip: ['Coin Flip', 'The house always wins. The house is Kevin.'],
  slots: ['Southbag Slots', 'Machine rental fee applied. The machine is also Kevin.'],
  gamble: ['Card Table', 'Dealer tip is mandatory. The dealer does not tip back.'],
  daily: ['Daily Reward', 'Come back tomorrow. Or do not.'],
  crypto: ['Southbag Crypto Exchange', 'Not financial advice. Not advice. Not finance.'],
  upgrade: ['Account Upgrade', 'Benefits: none. Prestige: also none.'],
  gift: ['Gift Sent', 'Being nice costs extra.'],
  insure: ['Southbag Insurance', 'Claims are always denied. But you paid anyway.'],
  beg: ['Begging', 'Dignity not included.'],
  notifs: ['Notifications', 'Enjoy the anxiety.'],
  'mystery-fee': ['Mystery Fee', 'You literally asked for this.'],
  invest: ['Southbag Investments', 'Past performance does not predict future results. Neither does anything else at Southbag.'],
  inventory: ['Your Inventory', 'None of them useful.'],
  combine: ['Items Combined', 'Crafting fee applied.'],
  use: ['Item Used', 'The item is gone forever. Worth it? Probably not.'],
  lottery: ['Southbag Lottery', "May the odds be ever in Kevin's favor."],
  heist: ['Vault Heist', 'Fortune favors the bold. Southbag favors nobody.'],
  leaderboard: ['Southbag Rich List', 'Wealth is temporary. Southbag fees are forever.'],
  audit: ['Financial Audit', 'Privacy is a myth.'],
};

const ITEM_FLAVOUR = {
  blahaj: 'It stares at you with its beady little eyes. You feel... comforted. Kevin does not approve.',
  fee_insurance: "A laminated card that says 'NO FEES' in Comic Sans. The fine print says 'lol jk maybe'.",
  kevins_briefcase: "It hums faintly. You haven't opened it. You won't. You can't.",
  kevins_arm: 'It signed three forms while you were asleep. The handwriting is better than yours.',
  kevins_blahaj: 'The shark wears a tiny tie. Support refuses to look directly at it.',
  kevins_left_sock: 'It crawled three inches toward payroll. You pretended not to see.',
  kevins_spare_glasses: 'You put them on once. Every balance showed negative Kevin.',
  kevins_lunch: 'It expires yesterday. The container is still warm. The spoon is missing.',
  kevins_shadow: 'It lies under your desk. It points toward Kevin even when Kevin is elsewhere.',
  kevin_detector: 'It beeps faster when you think about refunds. So does Kevin.',
  kevin_repellent: 'You sprayed it once. Kevin appeared to inspect the smell.',
  prohibited_shark_permit: 'Stamped DENIED, then APPROVED, then DENIED again. The ink is wet.',
  southbag_loyalty_card: 'It has one stamp. The stamp says FEE. All future stamps also say FEE.',
  office_air_sample: 'You opened it slightly. The room became a meeting.',
  compliance_rock: 'It is heavier when auditors enter the room. Nobody can explain this.',
  office_light_bulb: '60 watts of pure rebellion. The flickering has stopped. For now.',
  incident_report: "Every page is blacked out. Except one word on page 47: 'Kevin.'",
  southbag_mug: 'The handle broke off immediately. Classic Southbag quality. Still holds liquid though. Barely.',
  kevins_parking_spot: 'A laminated parking pass. Kevin has been circling the lot for weeks. He suspects nothing.',
  kevins_stapler: "It's warm to the touch. It shouldn't be warm. Kevin's initials are carved into the bottom.",
  break_room_key: "The key fits the lock but the door won't open. Something is blocking it from the inside.",
  employee_handbook: "Page 1: 'Don't.' Page 2: 'Seriously.' Pages 3-400: Blank.",
  office_plant: "You've been watering it for weeks before realising. The pot is empty. There is no soil.",
  motivational_poster: "The frame is bolted to the wall. You cannot remove it. You've tried.",
  kevins_voicemail: 'You played it once. You will not play it again.',
  fire_extinguisher: "The label says 'For emergency use only.' Below that, someone wrote 'there is no emergency. there was never an emergency.'",
  parking_cone: "Kevin walked past your desk three times today. He's getting closer.",
  server_rack_dust: "It glows faintly in the dark. IT says that's normal. IT hasn't been seen in weeks.",
  complaint_form: 'You filled it out anyway. The ink disappeared. The form is blank again.',
  kevins_tie: "It smells like regret and expensive cologne. The stain moves when you're not looking.",
  ceiling_tile: "You held it up to a mirror. The writing says your name. That's impossible. You bought this today.",
  security_badge: "The photo on it isn't you. It's Kevin. All the badges are Kevin.",
  fluorescent_tube: "It whispers. You tell yourself it's just the electrical hum. It isn't.",
  kevins_chair: "It rolled towards you when no one was in the room. It's in your cubicle now. It won't leave.",
  kevins_password: "It's '1234'. It's always been '1234'. You expected more. Kevin did not.",
  water_cooler: 'It gurgles at exactly 3 PM every day. There is no water inside. There is no mechanism.',
  exit_sign: "You followed it once. You ended up in Kevin's office. He was waiting.",
  kevins_family_photo: 'You stared at the empty frame for too long. Something stared back.',
  broken_clock: 'You wound it. The hands moved backwards. Your phone clock changed too.',
  sticky_notes: "You peeled one off. Underneath was another that said 'TOO LATE'.",
  office_key_card: 'You swiped it at the elevator. Floor 3 appeared. You did not press it. The doors closed.',
  paper_shredder: "You fed it a blank page. It spat out a page with your employee review. You don't work here.",
  kevins_coffee_mug: 'You tried to pour it out. It refilled. You tried again. It refilled faster.',
  whiteboard_marker: "You drew a circle. When you looked back, it was a door. It's gone now.",
  desk_drawer_contents: "It stopped rattling. That's worse.",
  visitor_badge: "You tried to take it off. It's attached. It's always been attached.",
  network_cable: 'You traced it through the wall. It goes into the floor. Then up. Into your desk. Out your monitor. Into the cable.',
  kevins_nameplate: "It says your name now. It's been on your desk all morning. You didn't put it there.",
  emergency_manual: "You opened to Step 3. Kevin's phone number is your phone number.",
};

const GIFT_ANNOUNCEMENTS = {
  blahaj: 'Southbag Support has gone offline.',
  fee_insurance: 'Southbag Support is recalculating your fees. Nervously.',
  kevins_briefcase: 'Kevin would like a word.',
  kevins_arm: 'Kevin waved. Nobody saw which arm he used.',
  kevins_blahaj: 'A shark-shaped silence has entered the office.',
  kevins_left_sock: "Kevin's shoes made one fewer sound in the hallway.",
  kevins_spare_glasses: "Every monitor briefly displayed Kevin's prescription.",
  kevins_lunch: 'The break room fridge locked itself from inside.',
  kevins_shadow: 'The office lights flickered. Kevin still cast two shadows.',
  kevin_detector: 'Something started beeping. It has not stopped.',
  kevin_repellent: 'Kevin stepped closer. The can hissed in fear.',
  prohibited_shark_permit: 'Legal reviewed the shark permit and began sweating.',
  southbag_loyalty_card: 'Customer retention has been notified. They laughed.',
  office_air_sample: 'Facilities filed a complaint against the atmosphere.',
  compliance_rock: 'Compliance approved the rock. The rock approved nothing.',
  office_light_bulb: 'The flickering light in aisle 3 has been claimed.',
  incident_report: 'Legal has been notified. Again.',
  southbag_mug: 'HR is pretending not to notice.',
  kevins_parking_spot: 'Kevin is circling the parking lot. He looks upset.',
  kevins_stapler: 'Kevin is checking his desk drawer. He looks concerned.',
  break_room_key: 'A sound was heard from behind the break room door.',
  employee_handbook: 'HR has been notified. HR does not respond.',
  office_plant: 'The fake plant has been adopted. Facilities is confused.',
  motivational_poster: 'The poster on the wall has changed. No one touched it.',
  kevins_voicemail: "Someone's phone rang. No one has a phone.",
  fire_extinguisher: 'The fire marshal has been notified. The fire marshal does not exist.',
  parking_cone: 'Kevin is in the parking lot. He found the empty space.',
  server_rack_dust: 'The server room temperature dropped 3 degrees.',
  complaint_form: 'A complaint was filed. It was immediately lost.',
  kevins_tie: 'Kevin reached for his neck. Something is missing.',
  ceiling_tile: 'A ceiling tile is missing. Nobody looked up.',
  security_badge: 'Security has been alerted. Security is Kevin.',
  fluorescent_tube: 'The lights in aisle 4 went out. Then came back. Different.',
  kevins_chair: "Kevin stood up. His chair rolled away. He didn't follow it.",
  kevins_password: 'IT has been alerted. IT is Kevin.',
  water_cooler: 'The water cooler in the lobby is gone. Nobody moved it.',
  exit_sign: 'The exit signs in the building have all rotated 90 degrees.',
  kevins_family_photo: "Kevin's desk has been cleaned. By no one.",
  broken_clock: 'Every clock in the office stopped. Then started again. At 2:19.',
  sticky_notes: "New sticky notes have appeared on Kevin's door. They say 'THANK YOU'.",
  office_key_card: "The elevator made a sound it's never made before.",
  paper_shredder: 'The shredder in HR ran by itself for 30 seconds.',
  kevins_coffee_mug: "There's a coffee ring on your desk. You don't drink coffee.",
  whiteboard_marker: 'The whiteboard in the meeting room is full. The meeting room was locked.',
  desk_drawer_contents: 'Something in the building shifted. Subtly.',
  visitor_badge: "Reception has a new permanent visitor. It's you.",
  network_cable: 'The Wi-Fi went out for exactly one second. Every screen flickered.',
  kevins_nameplate: "Kevin's office door is blank. He doesn't seem to notice.",
  emergency_manual: 'The fire alarm tested itself. It passed. Barely.',
};

const KEVIN_REACTIONS = [
  'Kevin has acknowledged your offering. He did not smile.',
  'Kevin took it without a word. This is the best possible outcome.',
  'Kevin looked at it, looked at you, and walked away. Progress.',
  "Kevin's assistant placed it on The Pile. You don't ask about The Pile.",
  'Kevin nodded. You have never seen Kevin nod before. You feel strange.',
];

const pick = list => list[Math.floor(Math.random() * list.length)];
const plain = text => ({ type: 'plain_text', text: String(text).slice(0, 150), emoji: true });
const mrkdwn = text => ({ type: 'mrkdwn', text: String(text).slice(0, 2900) });
const header = text => ({ type: 'header', text: plain(text) });
const section = text => ({ type: 'section', text: mrkdwn(text) });
const fields = list => ({ type: 'section', fields: list.map(mrkdwn) });
const context = text => ({ type: 'context', elements: [mrkdwn(text)] });
const divider = () => ({ type: 'divider' });
const button = (text, action_id, extra = {}) => ({ type: 'button', text: plain(text), action_id, ...extra });
const input = (block_id, label, element, extra = {}) => ({ type: 'input', block_id, label: plain(label), element, ...extra });
const textInput = (action_id, placeholder) => ({ type: 'plain_text_input', action_id, placeholder: plain(placeholder) });
const numberInput = (action_id, placeholder, decimal = false) => ({ type: 'number_input', action_id, is_decimal_allowed: decimal, placeholder: plain(placeholder) });
const userSelect = (action_id, placeholder) => ({ type: 'users_select', action_id, placeholder: plain(placeholder) });
const modal = (callback_id, title, blocks, extra = {}) => ({ type: 'modal', callback_id, title: plain(title), blocks, ...extra });
const errors = map => ({ response_action: 'errors', errors: map });
const mention = user => (user?.slack_user_id ? `<@${user.slack_user_id}>` : user?.name || user?.email || 'someone');
const dollars = value => Math.round(Number(value) * 100);
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const empty = () => new Response('', { status: 200 });
const value = (view, block, action) => view.state?.values?.[block]?.[action];

export function slackBotConfigured(env) {
  return Boolean(env?.SLACK_BOT_TOKEN && env?.SLACK_SIGNING_SECRET);
}

// Everything the handlers need. Tests inject a memory repo and a fake Slack client.
export function createBot(env, { repo, slack, waitUntil } = {}) {
  return {
    env,
    repo: repo || createD1Repo(env.DB),
    slack: slack || createSlackClient(env.SLACK_BOT_TOKEN),
    allowedChannel: env.SLACK_ALLOWED_CHANNEL || DEFAULT_ALLOWED_CHANNEL,
    admins: String(env.SLACK_ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    waitUntil: waitUntil || (promise => promise),
    botUserId: null,
  };
}

// --- HTTP entry point (Events API, slash commands, interactivity all share one URL) ---
export async function handleSlackRequest(request, env, ctx, overrides = {}) {
  if (!slackBotConfigured(env)) return json({ error: 'Slack bot is not configured' }, 503);
  const body = await request.text();
  if (!(await verifySlackRequest(env.SLACK_SIGNING_SECRET, request.headers, body))) {
    return json({ error: 'Invalid Slack signature' }, 401);
  }
  const bot = createBot(env, { waitUntil: promise => ctx?.waitUntil?.(promise), ...overrides });
  const background = promise => bot.waitUntil(promise.catch(error => console.error('Slack background task failed:', error)));

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = JSON.parse(body);
    if (payload.type === 'url_verification') return json({ challenge: payload.challenge });
    if (payload.type === 'event_callback') {
      // Slack retries when we are slow; we ack fast and dedupe on event_id so retries are harmless.
      if (request.headers.get('x-slack-retry-num')) return new Response('', { status: 200, headers: { 'x-slack-no-retry': '1' } });
      background(handleEvent(bot, payload));
    }
    return empty();
  }

  const form = new URLSearchParams(body);
  if (form.get('payload')) {
    return handleInteraction(bot, JSON.parse(form.get('payload')), background);
  }
  if (form.get('command')) {
    const command = Object.fromEntries(form);
    background(handleSlashCommand(bot, command).catch(async error => {
      console.error('Slash command failed:', error);
      await bot.slack.respond(command.response_url, { response_type: 'ephemeral', text: "Look, even our systems don't want to deal with you right now. Try again later." });
    }));
    return empty();
  }
  return json({ error: 'Unsupported Slack payload' }, 400);
}

// --- helpers shared by commands, events and interactions ---
async function isAdmin(bot, slackId) {
  if (bot.admins.includes(slackId)) return true;
  const resolved = await resolveSlackUser(bot.repo, slackId);
  if (!resolved) return false;
  const account = await bot.repo.getAccount(resolved.user.id);
  return Boolean(account?.is_admin);
}

async function bannedMessage(bot, slackId) {
  const resolved = await resolveSlackUser(bot.repo, slackId);
  if (!resolved) return null;
  const status = banStatus(await bot.repo.getAccount(resolved.user.id));
  if (!status.banned) return null;
  return status.expiry
    ? `Your account is suspended until ${new Date(status.expiry).toLocaleDateString()}. Do not contact us. — Kevin`
    : 'Your account is suspended. Do not contact us. — Kevin';
}

async function notifyBalanceChange(bot, user, description, amount, newBalance) {
  try {
    const account = await bot.repo.getAccount(user.id);
    if (!account?.notifications || !user.slack_user_id) return;
    const sign = amount >= 0 ? '+' : '-';
    await bot.slack.postMessage({
      channel: user.slack_user_id,
      text: `*Balance Update*\n${description}: ${sign}${money(Math.abs(amount))}\nNew balance: ${money(newBalance)}`,
    });
  } catch {}
}

async function mentionedUsers(bot, text) {
  const ids = [...String(text || '').matchAll(MENTION)].map(match => match[1]);
  const users = [];
  for (const id of new Set(ids)) {
    const resolved = await resolveSlackUser(bot.repo, id);
    if (resolved) users.push(resolved.user);
  }
  return users;
}

// Run an economy action and DM anyone whose balance moved (if they turned notifications on).
async function runEconomy(bot, user, body, { watch = [], description } = {}) {
  const watched = [user, ...watch].filter((item, index, list) => item && list.findIndex(other => other.id === item.id) === index);
  const before = await Promise.all(watched.map(item => bot.repo.getAccount(item.id)));
  const result = await handleEconomy(bot.repo, user, body);
  const label = description || (body.action || String(body.command || '').replace(/^\/south-/, '').split(/\s+/)[0] || 'Southbag').replace(/-/g, ' ');
  for (let i = 0; i < watched.length; i++) {
    const after = await bot.repo.getAccount(watched[i].id);
    if (!after || !before[i] || after.balance === before[i].balance) continue;
    await notifyBalanceChange(bot, watched[i], label.charAt(0).toUpperCase() + label.slice(1), after.balance - before[i].balance, after.balance);
  }
  return result;
}

function render(action, result, responseType = 'ephemeral') {
  if (!result.ok) return { response_type: 'ephemeral', text: result.text };
  const [title, footer] = FLAVOUR[action] || ['Southbag Online Banking', 'Kevin is aware.'];
  return { response_type: responseType, text: result.text, blocks: [header(title), section(result.text), context(`_${footer}_`)] };
}

async function announce(bot, payload) {
  try {
    await bot.slack.postMessage({ channel: bot.allowedChannel, ...payload });
  } catch (error) {
    console.error('Error posting announcement:', error);
  }
}

async function whisper(bot, slackId, payload) {
  try {
    await bot.slack.postEphemeral({ channel: slackId, user: slackId, ...payload });
  } catch {
    try { await bot.slack.postMessage({ channel: slackId, ...payload }); } catch {}
  }
}

// --- slash commands ---
export async function handleSlashCommand(bot, command) {
  const action = String(command.command || '').replace(/^\/south-/, '').toLowerCase();
  const slackId = command.user_id;
  const text = String(command.text || '').trim();
  const respond = payload => bot.slack.respond(command.response_url, payload);

  const banned = await bannedMessage(bot, slackId);
  if (banned) return respond({ response_type: 'ephemeral', text: banned });

  if (action === 'open-account') {
    const resolved = await resolveSlackUser(bot.repo, slackId, { create: true, name: text || command.user_name || null });
    const result = await runEconomy(bot, resolved.user, { action: 'open-account' });
    const account = result.account;
    const intro = resolved.imported
      ? 'Welcome back. The old bot remembered everything. Especially the fees.'
      : resolved.created
        ? "Congratulations. You now have a Southbag account. We're as thrilled as you are."
        : 'You already have an account. We do not do seconds.';
    return respond({
      response_type: 'ephemeral',
      text: `${intro} Account ${account.account_number}, balance ${money(account.balance)}.`,
      blocks: [
        header('Welcome to Southbag Online Banking'),
        section(`${intro}\n\n*Account Number:* \`${account.account_number}\`\n*Balance:* ${money(account.balance)}\n*Status:* ${account.status}\n\n_Your welcome bonus has been deposited and immediately taxed._`),
        context('_Terms and conditions: there are none. Good luck._'),
      ],
    });
  }

  if (action === 'leaderboard') {
    const result = await handleEconomy(bot.repo, { id: 'slack:' + slackId }, { action: 'leaderboard', sub: text.toLowerCase() });
    if (!result.ok || !result.rows?.length) return respond({ response_type: 'ephemeral', text: result.text });
    const bottom = text.toLowerCase() === 'bottom';
    const lines = result.rows.map((row, index) => `${index + 1}. ${mention(row)} — ${money(row.balance)} (${row.status || 'active'})`);
    return respond({
      response_type: 'in_channel',
      text: bottom
        ? `*THE WALL OF SHAME*\n\n${lines.join('\n')}\n\n_These people owe more than they own. Inspirational._`
        : `*SOUTHBAG RICH LIST*\n\n${lines.join('\n')}\n\n_Wealth is temporary. Southbag fees are forever._`,
    });
  }

  const resolved = await resolveSlackUser(bot.repo, slackId, { name: command.user_name || null });
  if (!resolved) {
    return respond({ response_type: 'ephemeral', text: "You don't have an account. Use `/south-open-account` to open one. We'll make it worth your while. (We won't.)" });
  }
  const user = resolved.user;

  if (action === 'deposit') {
    if (!(await isAdmin(bot, slackId))) return respond({ response_type: 'ephemeral', text: "You don't have permission to deposit. Nice try." });
    const [target] = await mentionedUsers(bot, text);
    const amount = parseFloat(text.replace(MENTION, '').trim());
    if (!target || !(amount > 0)) return respond({ response_type: 'ephemeral', text: 'Usage: `/south-deposit @user <amount>`\nMake sure you select the user from the dropdown when typing @.' });
    const result = await runEconomy(bot, target, { action: 'deposit', amount }, { description: 'Deposit' });
    if (!result.ok) return respond({ response_type: 'ephemeral', text: result.text });
    return respond({
      response_type: 'ephemeral',
      text: `Deposited to ${mention(target)}. ${result.text}`,
      blocks: [header('Deposit Processed'), section(`*Deposited to:* ${mention(target)}\n${result.text}`), context('_The 27% deposit shrinkage is a feature, not a bug._')],
    });
  }

  if (action === 'shop') return openShop(bot, command, user);
  if (action === 'combine') return openCombine(bot, command, user);
  if (action === 'use') return openUse(bot, command, user);
  if (action === 'inventory') return respond(await renderInventory(bot, user));
  if (action === 'lottery' && text.toLowerCase().startsWith('buy')) return openLotteryBuy(bot, command, user, text);
  if (action === 'transactions') {
    const result = await handleEconomy(bot.repo, user, { action: 'transactions' });
    if (!result.transactions?.length) return respond({ response_type: 'ephemeral', text: result.text });
    const lines = result.transactions.map(row => {
      const sign = row.amount >= 0 ? '+' : '-';
      return `${new Date(row.created_at).toLocaleDateString()}  ${sign}${money(Math.abs(row.amount))}${row.amount < 0 ? ' ⬇️' : ' ⬆️'}  ${row.description}`;
    });
    return respond({ response_type: 'ephemeral', text: lines.join('\n'), blocks: [header('Transaction History'), section(lines.join('\n')), context('_Some transactions may be missing. Hard to say._')] });
  }

  const watch = await mentionedUsers(bot, text);
  const result = await runEconomy(bot, user, { command: `${command.command} ${text}`.trim() }, { watch });
  if (action === 'audit' && result.ok) {
    const lines = (result.transactions || []).map(row => `  ${row.kind}: ${row.amount >= 0 ? '+' : '-'}${money(Math.abs(row.amount))} — ${row.description}`).join('\n') || '  none';
    const target = result.target;
    return respond({
      response_type: 'in_channel',
      text: `*FINANCIAL AUDIT: ${mention(target)}*\n\nBalance: ${money(target.balance)}\nStatus: ${target.status}\nTier: ${target.tier}\nAccount: \`${target.account_number}\`\n\n*Recent transactions:*\n${lines}\n\n_Audit fee: ${money(result.fee)} charged to ${mention(user)}. Privacy is a myth._`,
    });
  }
  if (action === 'heist' && result.ok) {
    return respond({ response_type: 'in_channel', text: `${mention(user)}: ${result.text}` });
  }
  return respond(render(action, result, IN_CHANNEL.has(action) ? 'in_channel' : 'ephemeral'));
}

async function renderInventory(bot, user) {
  const result = await handleEconomy(bot.repo, user, { action: 'inventory' });
  const inventory = result.inventory || [];
  if (!inventory.length) {
    return { response_type: 'ephemeral', text: '*Your Inventory*\n\nEmpty. Like your wallet. Like your soul.\n\nVisit `/south-shop` to buy things you don\'t need.' };
  }
  const counts = new Map();
  for (const item of inventory) {
    const entry = counts.get(item.itemId) || { name: item.name, count: 0, giftedBy: null, description: item.description };
    entry.count++;
    if (item.giftedBy) entry.giftedBy = item.giftedBy;
    counts.set(item.itemId, entry);
  }
  const lines = [];
  for (const [itemId, info] of counts) {
    let gift = '';
    if (info.giftedBy) {
      const giver = await bot.repo.getUser(info.giftedBy).catch(() => null);
      gift = ` _(gifted by ${giver ? mention(giver) : 'someone'})_`;
    }
    const flavour = ITEM_FLAVOUR[itemId] || info.description || "A mysterious item. Even we don't know what it does.";
    lines.push(`*${info.name}*${info.count > 1 ? ` (x${info.count})` : ''}${gift}\n_${flavour}_`);
  }
  return {
    response_type: 'ephemeral',
    text: lines.join('\n\n'),
    blocks: [header('Your Inventory'), section(lines.join('\n\n')), context(`_${inventory.length} item${inventory.length === 1 ? '' : 's'} total. None of them useful._`)],
  };
}

// --- shop modal and its overflow actions ---
function shopView(balance, meta) {
  const blocks = [header('Southbag Gift Shop'), context(`_Your balance: ${money(balance)} — All sales are final. All items are questionable._`), divider()];
  for (const [id, item] of Object.entries(SHOP_ITEMS)) {
    blocks.push({
      type: 'section',
      text: mrkdwn(`*${item.name}* — ${money(item.price)}\n_${item.description}_`),
      accessory: {
        type: 'overflow',
        action_id: `shop_action_${id}`,
        options: [
          { text: plain('Buy'), value: `buy_${id}` },
          { text: plain('Buy Multiple'), value: `buymulti_${id}` },
          { text: plain('Gift to someone'), value: `gift_${id}` },
          { text: plain('Gift to Kevin'), value: `giftkevin_${id}` },
        ],
      },
    });
  }
  blocks.push(divider(), context('_Kevin does not endorse any of these products. Especially the shark._'));
  return modal('shop_browse', 'Southbag Gift Shop', blocks, {
    notify_on_close: true,
    private_metadata: JSON.stringify(meta),
    close: plain('Leave (coward)'),
  });
}

async function openShop(bot, command, user) {
  const account = await bot.repo.getAccount(user.id);
  const view = shopView(account.balance, { userId: user.id, slackId: command.user_id, bought: false });
  try {
    await bot.slack.viewsOpen({ trigger_id: command.trigger_id, view });
  } catch {
    await bot.slack.respond(command.response_url, { response_type: 'ephemeral', text: 'The shop is open.', blocks: view.blocks });
  }
}

// Remember that they bought something so closing the modal does not charge the window shopping fee.
async function markBought(bot, view, user) {
  const rootId = view.root_view_id || view.id;
  if (!rootId) return;
  try {
    const meta = JSON.parse(view.private_metadata || '{}');
    if (view.callback_id !== 'shop_browse') return;
    const account = await bot.repo.getAccount(user.id);
    await bot.slack.call('views.update', { view_id: rootId, view: shopView(account.balance, { ...meta, bought: true }) });
  } catch {}
}

async function shopAction(bot, payload, action) {
  const slackId = payload.user.id;
  const resolved = await resolveSlackUser(bot.repo, slackId);
  if (!resolved) return whisper(bot, slackId, { text: 'No account. How did you even get here?' });
  const user = resolved.user;
  const selected = action.selected_option?.value || '';
  const [kind, ...rest] = selected.split('_');
  const itemId = rest.join('_');
  const item = SHOP_ITEMS[itemId];
  if (!item) return;

  if (kind === 'buy') {
    const result = await runEconomy(bot, user, { action: 'shop', item: itemId }, { description: `Shop: ${item.name}` });
    if (result.error === 'insufficient') {
      return whisper(bot, slackId, { text: pick([
        `You have ${money(result.balance)} and this costs ${money(result.price)}. Do the math. Actually, don't. You clearly can't.`,
        `Insufficient funds for ${item.name}. Have you tried not being broke?`,
        `${money(result.balance)} in your account and you're trying to buy a ${money(result.price)} item. The audacity.`,
        `You can't afford ${item.name}. Maybe try /south-beg first. It suits you.`,
      ]) });
    }
    if (!result.ok) return whisper(bot, slackId, { text: result.text });
    await markBought(bot, payload.view || {}, user);
    return whisper(bot, slackId, { text: `You bought *${item.name}* for ${money(result.price)}.\nNew balance: ${money(result.balance)}\n\n_Check /south-inventory to admire your questionable purchases._` });
  }

  if (kind === 'giftkevin') {
    const result = await runEconomy(bot, user, { action: 'shop', item: itemId, tribute: true }, { description: `Tribute to Kevin: ${item.name}` });
    if (result.error === 'insufficient') return whisper(bot, slackId, { text: `You can't afford to tribute Kevin. You have ${money(result.balance)} and this costs ${money(result.price)}. He'll remember this.` });
    if (result.error === 'frozen') return whisper(bot, slackId, { text: 'Your account is frozen. Kevin does not accept gifts from the frozen.' });
    if (!result.ok) return whisper(bot, slackId, { text: result.text });
    await markBought(bot, payload.view || {}, user);
    return announce(bot, { text: `<@${slackId}> has offered a *${item.name}* as tribute to Kevin.\n\n_${pick(KEVIN_REACTIONS)}_` });
  }

  const meta = JSON.stringify({ itemId, userId: user.id, slackId });
  const view = kind === 'gift'
    ? modal('gift_modal', 'Gift an Item', [
      section(`*${item.name}* — ${money(item.price)}\n_This will be deducted from your balance._`),
      input('recipient_block', 'Recipient', userSelect('recipient', 'Pick a victim')),
      input('message_block', 'Message', textInput('gift_message', "Optional message (they probably won't appreciate it)"), { optional: true }),
    ], { private_metadata: meta, submit: plain('Send Gift'), close: plain('Nevermind') })
    : modal('buy_multi_modal', 'Buy Multiple', [
      section(`*${item.name}* — ${money(item.price)} each\n_Why buy one when you can regret buying many?_`),
      input('quantity_block', 'Quantity', { ...numberInput('quantity', 'How many?'), min_value: '1', max_value: '99' }),
    ], { private_metadata: meta, submit: plain('Buy'), close: plain('Nevermind') });
  const open = payload.view ? bot.slack.viewsPush : bot.slack.viewsOpen;
  await open({ trigger_id: payload.trigger_id, view });
}

// --- combine / use modals (AI-crafted items) ---
function itemOptions(items) {
  return items.slice(0, 100).map((item, index) => ({
    text: plain((item.name || 'Unknown').slice(0, 75).replace(/[^\w\s-]/g, '') || `Item ${index + 1}`),
    value: item.itemId,
  }));
}

async function openCombine(bot, command, user) {
  const account = await bot.repo.getAccount(user.id);
  if (!account.inventory.length) return whisper(bot, command.user_id, { text: "Your inventory is empty. Can't combine nothing with nothing." });
  const unique = [...new Map(account.inventory.map(item => [item.itemId, item])).values()];
  const view = modal('combine_modal', 'Combine Items', [
    input('item_a_block', 'First Item', { type: 'static_select', action_id: 'item_a_select', placeholder: plain('Choose first item'), options: itemOptions(unique) }),
    input('item_b_block', 'Second Item', { type: 'static_select', action_id: 'item_b_select', placeholder: plain('Choose second item'), options: itemOptions(unique) }),
  ], { private_metadata: JSON.stringify({ userId: user.id, slackId: command.user_id }), submit: plain('Combine'), close: plain('Cancel') });
  await bot.slack.viewsOpen({ trigger_id: command.trigger_id, view });
}

async function openUse(bot, command, user) {
  const account = await bot.repo.getAccount(user.id);
  const combined = account.inventory.filter(item => String(item.itemId).startsWith('combo:'));
  if (!account.inventory.length) return whisper(bot, command.user_id, { text: 'Your inventory is empty. Craft something with `/south-combine` first.' });
  if (!combined.length) return whisper(bot, command.user_id, { text: "You don't have any combined items. Craft one with `/south-combine` first." });
  const unique = [...new Map(combined.map(item => [item.itemId, item])).values()];
  const view = modal('use_item_modal', 'Use Combined Item', [
    input('item_block', 'Select an item to use', { type: 'static_select', action_id: 'item_select', placeholder: plain('Choose an item'), options: itemOptions(unique) }),
    input('target_block', 'Target', { type: 'static_select', action_id: 'target_type', placeholder: plain('Choose a target'), options: [
      { text: plain('A User'), value: 'user' }, { text: plain('Kevin'), value: 'kevin' }, { text: plain('Southbag Support'), value: 'support' },
    ] }),
    input('user_target_block', 'User Target', userSelect('target_user', 'Select a user'), { optional: true }),
  ], { private_metadata: JSON.stringify({ userId: user.id, slackId: command.user_id }), submit: plain('Use Item'), close: plain('Cancel') });
  await bot.slack.viewsOpen({ trigger_id: command.trigger_id, view });
}

async function combineItems(bot, meta, itemIdA, itemIdB) {
  const user = await bot.repo.getUser(meta.userId);
  const account = await bot.repo.getAccount(meta.userId);
  const itemA = account?.inventory.find(item => item.itemId === itemIdA);
  const itemB = account?.inventory.find(item => item.itemId === itemIdB && item !== itemA);
  if (!user || !itemA || !itemB) return whisper(bot, meta.slackId, { text: 'One of the items is no longer in your inventory.' });

  const body = { action: 'combine', itemA: itemIdA, itemB: itemIdB };
  if (!findCombo(itemIdA, itemIdB)) {
    try {
      const reply = await chat([
        { role: 'system', content: 'You are a creative AI for an Infinite Craft-like game. Respond ONLY with valid JSON, no other text.' },
        { role: 'user', content: `You are a creative AI in an "Infinite Craft" style game set in the Southbag Online Banking universe. Two office items have been combined.\n\nGenerate a creative, humorous new item that results from combining these two things. Keep the Southbag dark humor tone.\n\nItem 1: ${itemA.name}\nItem 2: ${itemB.name}\n\nRespond ONLY in this exact JSON format (no markdown, no extra text):\n{\n  "name": "Name of the new combined item",\n  "description": "A brief 1-2 sentence description with dark Southbag humor"\n}` },
      ], bot.env);
      const parsed = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '');
      body.resultName = parsed.name;
      body.resultDescription = parsed.description;
    } catch (error) {
      console.error('Error generating combination:', error);
      await runEconomy(bot, user, { action: 'fee', amount: 0.10, reason: 'Failed combination attempt fee' });
      return whisper(bot, meta.slackId, { text: 'The items rejected each other. Better luck next time. Failed combination fee: $0.10.' });
    }
  }
  const result = await runEconomy(bot, user, body, { description: 'Crafting fee' });
  if (!result.ok) return whisper(bot, meta.slackId, { text: result.text });
  await announce(bot, {
    text: `<@${meta.slackId}> combined ${itemA.name} + ${itemB.name} into ${result.item.name}`,
    blocks: [
      header('✨ ITEMS COMBINED'),
      section(`<@${meta.slackId}> combined *${itemA.name}* + *${itemB.name}*\n\n*${result.item.name}*\n_${result.item.description}_`),
      context(`_Crafting fee: ${money(result.fee)} · New balance: ${money(result.balance)}_`),
    ],
  });
}

async function useItem(bot, meta, itemId, targetType, targetSlackId) {
  const user = await bot.repo.getUser(meta.userId);
  if (!user) return;
  const targetLabel = targetType === 'kevin' ? 'Kevin' : targetType === 'support' ? 'Southbag Support' : `<@${targetSlackId}>`;
  const result = await runEconomy(bot, user, { action: 'use', item: itemId, target: targetType === 'user' ? targetSlackId : targetType }, { description: 'Item usage fee' });
  if (!result.ok) return whisper(bot, meta.slackId, { text: result.text });

  let reaction = result.text;
  if (!result.scripted) {
    const targetDescription = targetType === 'kevin' ? 'Kevin (the CEO)' : targetType === 'support' ? 'Southbag Support' : `a user (${targetLabel})`;
    try {
      reaction = await chat([
        { role: 'system', content: 'You are a character in the Southbag Online Banking system. Respond briefly and darkly humorously.' },
        { role: 'user', content: `A user just used a combined item on ${targetDescription}. Respond in character as the target, reacting to being hit/affected by this item. Keep it short (1-3 sentences max), sarcastic, and in keeping with Southbag's dark humor.\n\nItem: ${result.item.name}\nWhat it is: ${result.item.description}\nMade from: ${(result.item.ingredients || []).join(' + ') || 'unknown parts'}\nUsed on: ${targetDescription}\n\nRespond as the target experiencing this item's effect. Be dramatic and humorous. You can include fee charges using [FEE:amount:reason] format if appropriate.` },
      ], bot.env);
    } catch (error) {
      console.error('Error generating AI response:', error);
      reaction = `${targetLabel} stares blankly at the ${result.item.name}. Nothing happens. Everything is broken now. [FEE:1.00:AI system failure surcharge]`;
    }
  }
  const { cleanText, commands } = parseCommands(reaction);
  const say = payload => announce(bot, payload);
  await say({
    text: `<@${meta.slackId}> used ${result.item.name} on ${targetLabel}: ${cleanText}`,
    blocks: [
      header(`${result.item.name} USED ON ${targetType === 'user' ? 'A VICTIM' : targetLabel.toUpperCase()}`),
      section(`<@${meta.slackId}> used *${result.item.name}* on ${targetLabel}:\n\n${cleanText}`),
      context(`_Item consumed · Usage fee: ${money(result.fee)} · The item is gone forever. Worth it? Probably not._`),
    ],
  });
  if (commands.length) {
    await executeCommands(commands, {
      say, slack: bot.slack, repo: bot.repo, user,
      event: { channel: bot.allowedChannel, user: meta.slackId, ts: String(Date.now() / 1000) },
      notifyBalanceChange: (target, description, amount, balance) => notifyBalanceChange(bot, target, description, amount, balance),
    });
  }
}

// --- lottery ---
async function openLotteryBuy(bot, command, user, text) {
  const info = await handleEconomy(bot.repo, user, { action: 'lottery', sub: 'info' });
  const lottery = info.lottery;
  if (!lottery) return bot.slack.respond(command.response_url, { response_type: 'ephemeral', text: 'No lottery running right now.' });
  const inline = text.replace(/^buy\s*/i, '').trim();
  if (inline) {
    const result = await runEconomy(bot, user, { command: `/south-lottery ${text}` }, { description: 'Lottery ticket' });
    return bot.slack.respond(command.response_url, render('lottery', result));
  }
  await bot.slack.viewsOpen({
    trigger_id: command.trigger_id,
    view: modal('lottery_buy_modal', 'Buy Lottery Ticket', [
      section(`*${lottery.name}*\nTicket price: ${money(lottery.ticket_price)}\nPick ${lottery.pick_count} numbers from 1-${lottery.max_number}\nJackpot: ${money(lottery.jackpot)}`),
      input('numbers_block', `Pick ${lottery.pick_count} numbers (1-${lottery.max_number})`, textInput('numbers', 'e.g. 3 17 22')),
    ], { private_metadata: JSON.stringify({ userId: user.id, slackId: command.user_id, pickCount: lottery.pick_count, maxNumber: lottery.max_number }), submit: plain('Buy Ticket') }),
  });
}

// --- interactivity (block_actions, view_submission, view_closed) ---
export async function handleInteraction(bot, payload, background = bot.waitUntil) {
  if (payload.type === 'block_actions') {
    background(handleBlockAction(bot, payload));
    return empty();
  }
  if (payload.type === 'view_submission') {
    const response = await handleViewSubmission(bot, payload, background);
    return response ? json(response) : empty();
  }
  if (payload.type === 'view_closed' && payload.view?.callback_id === 'shop_browse') {
    background(windowShoppingFee(bot, payload));
    return empty();
  }
  return empty();
}

async function windowShoppingFee(bot, payload) {
  const meta = JSON.parse(payload.view.private_metadata || '{}');
  if (meta.bought || !meta.userId) return;
  const user = await bot.repo.getUser(meta.userId);
  if (!user) return;
  const result = await runEconomy(bot, user, { action: 'fee', amount: WINDOW_SHOPPING_FEE / 100, reason: 'Window shopping fee — looking is not free' }, { description: 'Window shopping fee' });
  if (!result.ok) return;
  await whisper(bot, meta.slackId, { text: `You left the shop without buying anything. That'll be *${money(WINDOW_SHOPPING_FEE)}* for wasting our time.\n\n_Window shopping fee applied. New balance: ${money(result.balance)}_` });
}

async function handleBlockAction(bot, payload) {
  const slackId = payload.user.id;
  for (const action of payload.actions || []) {
    const id = action.action_id || '';
    if (id.startsWith('shop_action_')) { await shopAction(bot, payload, action); continue; }
    if (id.startsWith('admin_') || id.startsWith('approve_')) {
      if (!(await isAdmin(bot, slackId))) { await whisper(bot, slackId, { text: 'Nothing to see here.' }); continue; }
      await adminAction(bot, payload, action);
    }
  }
}

async function handleViewSubmission(bot, payload, background) {
  const view = payload.view;
  const meta = JSON.parse(view.private_metadata || '{}');
  const slackId = payload.user.id;

  switch (view.callback_id) {
    case 'gift_modal': {
      const recipientId = value(view, 'recipient_block', 'recipient')?.selected_user;
      const message = value(view, 'message_block', 'gift_message')?.value || '';
      const user = await bot.repo.getUser(meta.userId);
      const recipient = recipientId ? await resolveSlackUser(bot.repo, recipientId) : null;
      if (!user || !recipientId) return errors({ recipient_block: 'Pick a victim.' });
      if (recipientId === slackId) return errors({ recipient_block: "You can't gift yourself. That's just buying with extra steps." });
      if (!recipient) return errors({ recipient_block: "That user doesn't have a Southbag account." });
      const result = await runEconomy(bot, user, { action: 'shop', item: meta.itemId, recipient: recipientId }, { description: `Gift: ${SHOP_ITEMS[meta.itemId]?.name}` });
      if (result.error === 'insufficient') return errors({ recipient_block: `You can't afford this (${money(result.price)}). Balance: ${money(result.balance)}.` });
      if (!result.ok) return errors({ recipient_block: result.text });
      background((async () => {
        await markBought(bot, { ...view, id: view.root_view_id, callback_id: 'shop_browse', private_metadata: JSON.stringify({ userId: meta.userId, slackId }) }, user);
        await announce(bot, { text: `<@${slackId}> just gifted a *${result.item.name}* to <@${recipientId}>.${message ? `\n_"${message}"_` : ''}\n\n_${GIFT_ANNOUNCEMENTS[meta.itemId] || 'Southbag Support has no comment.'}_` });
      })());
      return null;
    }
    case 'buy_multi_modal': {
      const quantity = parseInt(value(view, 'quantity_block', 'quantity')?.value, 10);
      const user = await bot.repo.getUser(meta.userId);
      if (!user || !(quantity >= 1)) return errors({ quantity_block: 'Enter a quantity between 1 and 99.' });
      const result = await runEconomy(bot, user, { action: 'shop', item: meta.itemId, quantity }, { description: `Shop: ${SHOP_ITEMS[meta.itemId]?.name} x${quantity}` });
      if (result.error === 'insufficient') return errors({ quantity_block: `You can't afford ${quantity}x (${money(result.price)} total). Balance: ${money(result.balance)}.` });
      if (!result.ok) return errors({ quantity_block: result.text });
      background((async () => {
        await markBought(bot, { ...view, id: view.root_view_id, callback_id: 'shop_browse', private_metadata: JSON.stringify({ userId: meta.userId, slackId }) }, user);
        await whisper(bot, slackId, { text: `You bought *${result.quantity}x ${result.item.name}* for ${money(result.price)}.\nNew balance: ${money(result.balance)}\n\n_${result.quantity} of the same thing. Bold strategy._` });
      })());
      return null;
    }
    case 'combine_modal': {
      const a = value(view, 'item_a_block', 'item_a_select')?.selected_option?.value;
      const b = value(view, 'item_b_block', 'item_b_select')?.selected_option?.value;
      const missing = {};
      if (!a) missing.item_a_block = 'Please select first item';
      if (!b) missing.item_b_block = 'Please select second item';
      if (Object.keys(missing).length) return errors(missing);
      background(combineItems(bot, meta, a, b));
      return null;
    }
    case 'use_item_modal': {
      const itemId = value(view, 'item_block', 'item_select')?.selected_option?.value;
      const targetType = value(view, 'target_block', 'target_type')?.selected_option?.value;
      const targetUser = value(view, 'user_target_block', 'target_user')?.selected_user;
      const missing = {};
      if (!itemId) missing.item_block = 'Please select an item';
      if (!targetType) missing.target_block = 'Please select a target';
      if (targetType === 'user' && !targetUser) missing.user_target_block = 'Please select a user target';
      if (Object.keys(missing).length) return errors(missing);
      background(useItem(bot, meta, itemId, targetType, targetUser));
      return null;
    }
    case 'lottery_buy_modal': {
      const raw = String(value(view, 'numbers_block', 'numbers')?.value || '').trim();
      const numbers = raw.split(/[\s,]+/).filter(Boolean).map(n => parseInt(n, 10));
      if (numbers.length !== meta.pickCount) return errors({ numbers_block: `You must pick exactly ${meta.pickCount} numbers. You entered ${numbers.length}.` });
      if (numbers.some(n => Number.isNaN(n) || n < 1 || n > meta.maxNumber)) return errors({ numbers_block: `All numbers must be between 1 and ${meta.maxNumber}.` });
      if (new Set(numbers).size !== numbers.length) return errors({ numbers_block: 'No duplicate numbers allowed.' });
      const user = await bot.repo.getUser(meta.userId);
      if (!user) return errors({ numbers_block: "You don't have a Southbag account. Use /south-open-account first." });
      const result = await runEconomy(bot, user, { action: 'lottery', sub: 'buy', numbers }, { description: 'Lottery ticket' });
      if (!result.ok) return errors({ numbers_block: result.text });
      background(whisper(bot, slackId, { text: `*Ticket purchased!*\n${result.text}\nNew balance: ${money(result.balance)}` }));
      return null;
    }
    case 'lottery_create_modal':
    case 'admin_inspect_modal':
    case 'admin_warn_modal':
    case 'admin_ban_modal':
      if (!(await isAdmin(bot, slackId))) return errors({ [view.blocks?.[0]?.block_id || 'user_block']: 'Nothing to see here.' });
      return adminSubmission(bot, payload, background);
  }
  return null;
}

// --- App Home ---
function homeBlocks(overview) {
  const blocks = [header('Southbag Online Banking'), context('_"Where your money goes to die."_ — Kevin, CEO'), divider()];
  if (!overview.ok) {
    blocks.push(section('*You do not have a Southbag account.*\n\nUse `/south-open-account` to open one. We promise it will be the worst financial decision you make today.'));
    return blocks;
  }
  const { account, job, loan, insurance, crypto, transactions, lottery } = overview;
  blocks.push(section('*Account Overview*'), fields([
    `*Account Number*\n\`${account.accountNumber}\``, `*Balance*\n${money(account.balance)}`, `*Status*\n${account.status}`, `*Tier*\n${account.tier}`,
  ]), context(`Notifications: ${account.notifications ? 'On' : 'Off'}`), divider());

  blocks.push(section('*Employment*'));
  if (job) {
    blocks.push(fields([`*Position*\n${job.title}`, `*Salary*\n${money(job.salary)} per shift (before 40% tax)`]), context('Use `/south-work` to do a shift · `/south-quit` to escape'));
  } else {
    blocks.push(section("_Unemployed._ Use `/south-job` to apply. We're always hiring because everyone quits."));
  }
  blocks.push(divider(), section('*Loan Status*'));
  if (loan) {
    const hours = Math.round((Date.now() - loan.taken_at) / 36000) / 100;
    blocks.push(fields([
      `*Principal*\n${money(loan.principal)}`, `*Interest Rate*\n${(loan.interest_rate * 100).toFixed(0)}% per hour`,
      `*Interest Accrued*\n${money(loan.owed - loan.principal)}`, `*Total Owed*\n${money(loan.owed)}`,
    ]), context(`Loan age: ${hours}h · \`/south-loan repay\` to pay · \`/south-loan default\` to ruin everything`));
  } else {
    blocks.push(section('_No active loan._ Use `/south-loan <amount>` to take one out. Interest rates are criminal.'));
  }
  blocks.push(divider(), section('*Insurance*'));
  if (insurance) {
    const active = insurance.covered_until > Date.now();
    blocks.push(fields([
      `*Plan*\n${insurance.plan}`, `*Premium Paid*\n${money(insurance.premium)}`, `*Status*\n${active ? 'Active' : 'Expired'}`,
      `*Coverage*\n${active ? `Expires: ${new Date(insurance.covered_until).toLocaleString()}` : '*EXPIRED*'}`,
    ]), context('_Claims are always denied. But you paid anyway._'));
  } else {
    blocks.push(section("_Uninsured._ Use `/south-insure buy <basic|silver|gold>`. It won't help, but it costs money."));
  }
  blocks.push(divider(), section('*Crypto Portfolio*'));
  if (crypto?.length) {
    const lines = crypto.map(row => `*${row.coin}* — ${row.amount.toFixed(4)} coins @ ${money(row.current_price)} = ${money(row.value)} (${row.gain_loss >= 0 ? '+' : '-'}${money(Math.abs(row.gain_loss))})`);
    const total = crypto.reduce((sum, row) => sum + row.value, 0);
    blocks.push(section(lines.join('\n')), context(`Total portfolio value: *${money(total)}* · \`/south-crypto sell <coin>\` to cash out (10% tax)`));
  } else {
    blocks.push(section('_No crypto holdings._ Use `/south-crypto prices` to browse · `/south-crypto buy <coin> <amount>` to invest badly.'));
  }
  blocks.push(divider(), section('*Recent Transactions*'));
  if (transactions?.length) {
    const lines = transactions.slice(0, 10).map(row => `${new Date(row.created_at).toLocaleDateString()}  ${row.amount >= 0 ? '+' : '-'}${money(Math.abs(row.amount))}  ${row.description}`);
    blocks.push(section(lines.join('\n')), context(`Showing last ${Math.min(transactions.length, 10)} transactions · \`/south-transactions\` for full history`));
  } else {
    blocks.push(section('_No transactions yet. Give it time._'));
  }
  blocks.push(divider(), section('*Lottery*'));
  if (lottery?.status === 'open') {
    blocks.push(fields([`*Name*\n${lottery.name}`, `*Ticket Price*\n${money(lottery.ticket_price)}`, `*Pick*\n${lottery.pick_count} of ${lottery.max_number}`, `*Jackpot*\n${money(lottery.jackpot)}`]),
      context('Use `/south-lottery buy` to purchase a ticket · `/south-lottery my-tickets` to view yours'));
  } else {
    blocks.push(section("_No lottery running._ Check back later — Kevin might feel generous. (He won't.)"));
  }
  blocks.push(divider(), section('*Quick Commands*'), section([
    '*Banking:* `/south-balance` · `/south-transfer` · `/south-deposit`',
    '*Income:* `/south-daily` · `/south-job` · `/south-work` · `/south-beg`',
    '*Gambling:* `/south-coinflip` · `/south-slots` · `/south-gamble` · `/south-lottery`',
    '*Crime:* `/south-rob` · `/south-heist`',
    '*Investing:* `/south-crypto` · `/south-upgrade` · `/south-invest`',
    '*Shopping:* `/south-shop` · `/south-inventory` · `/south-combine` · `/south-use`',
    '*Other:* `/south-gift` · `/south-insure` · `/south-loan` · `/south-mystery-fee` · `/south-audit`',
    '*Settings:* `/south-notifs`',
  ].join('\n')), context("_Southbag Online Banking. We're not sorry._"));
  return blocks;
}

function adminBlocks(lottery) {
  const blocks = [header('Southbag Admin Panel'), context('_Kevin is watching._'), divider(), section('*User Management*'), {
    type: 'actions',
    elements: [
      button('Inspect User', 'admin_inspect_open'),
      button('Warn User', 'admin_warn_open'),
      button('Ban User', 'admin_ban_open', { style: 'danger' }),
    ],
  }, divider()];
  if (lottery?.status === 'open') {
    blocks.push(fields([`*Lottery:* ${lottery.name}`, `*Ticket Price:* ${money(lottery.ticket_price)}`, `*Jackpot:* ${money(lottery.jackpot)}`, `*Pick:* ${lottery.pick_count} of ${lottery.max_number}`]), {
      type: 'actions',
      elements: [
        button('Draw Winner', 'admin_lottery_draw', { style: 'primary', value: String(lottery.id) }),
        button('Cancel Lottery', 'admin_lottery_cancel', { style: 'danger', value: String(lottery.id) }),
        button('Replace Lottery', 'admin_lottery_create'),
      ],
    });
  } else {
    blocks.push({ type: 'section', text: mrkdwn('_No active lottery._'), accessory: button('Create Lottery', 'admin_lottery_create') });
  }
  blocks.push(divider());
  return blocks;
}

export async function publishHome(bot, slackId) {
  const resolved = await resolveSlackUser(bot.repo, slackId);
  const overview = resolved ? await handleEconomy(bot.repo, resolved.user, { action: 'overview' }) : { ok: false };
  let blocks = [];
  if (await isAdmin(bot, slackId)) {
    const lottery = overview.lottery || (await bot.repo.getOpenLottery());
    blocks = adminBlocks(lottery);
  }
  blocks = blocks.concat(homeBlocks(overview)).slice(0, 100);
  await bot.slack.viewsPublish({ user_id: slackId, view: { type: 'home', blocks } });
}

// --- admin panel actions (App Home) ---
async function adminAction(bot, payload, action) {
  const slackId = payload.user.id;
  const open = view => bot.slack.viewsOpen({ trigger_id: payload.trigger_id, view });
  switch (action.action_id) {
    case 'admin_lottery_create':
      return open(modal('lottery_create_modal', 'Create Lottery', [
        input('name_block', 'Lottery Name', textInput('name', "e.g. Kevin's Big Draw")),
        input('price_block', 'Ticket Price', numberInput('price', 'e.g. 5.00', true)),
        input('max_block', 'Max Number', numberInput('max_number', 'e.g. 50')),
        input('pick_block', 'Pick Count', numberInput('pick_count', 'e.g. 5')),
        input('jackpot_block', 'Starting Jackpot', numberInput('jackpot', 'e.g. 100.00', true)),
      ], { submit: plain('Create') }));
    case 'admin_lottery_draw': {
      const result = await drawLottery(bot.repo);
      if (!result.ok) await whisper(bot, slackId, { text: result.text });
      else if (result.winner) {
        await announce(bot, { text: `*LOTTERY DRAWN!*\n\nWinning numbers: *${result.winning.join(', ')}*\n\n*Winner:* ${mention(result.winner)} (matched ${result.matchCount}/${result.winning.length})\n*Payout:* ${money(result.jackpot)}\n\n_Congratulations. Don't spend it all in one place._` });
        const account = await bot.repo.getAccount(result.winner.id);
        await notifyBalanceChange(bot, result.winner, 'Lottery jackpot', result.jackpot, account?.balance ?? result.jackpot);
      } else {
        await announce(bot, { text: `*LOTTERY DRAWN!*\n\nWinning numbers: *${result.winning.join(', ')}*\n\n*No winner.* The jackpot goes back to Kevin. As intended.` });
      }
      return publishHome(bot, slackId);
    }
    case 'admin_lottery_cancel': {
      const result = await cancelLottery(bot.repo);
      if (result.ok) await announce(bot, { text: `*LOTTERY CANCELLED*\n\nThe lottery has been cancelled. ${result.refunded} ticket(s) fully refunded.` });
      else await whisper(bot, slackId, { text: result.text });
      return publishHome(bot, slackId);
    }
    case 'admin_inspect_open':
      return open(modal('admin_inspect_modal', 'Inspect User', [input('user_block', 'User', userSelect('target_user', 'Select a user'))], { submit: plain('Inspect') }));
    case 'admin_warn_open':
      return open(modal('admin_warn_modal', 'Warn User', [
        input('user_block', 'User', userSelect('target_user', 'Select a user')),
        input('reason_block', 'Reason', textInput('reason', 'Why are they being warned?')),
      ], { submit: plain('Generate Warning') }));
    case 'admin_ban_open':
      return open(modal('admin_ban_modal', 'Ban User', [
        input('user_block', 'User', userSelect('target_user', 'Select a user')),
        input('duration_block', 'Duration (days, or "permanent")', textInput('duration', 'e.g. 7 or permanent')),
        input('reason_block', 'Reason', textInput('reason', 'Why are they being banned?')),
      ], { submit: plain('Generate Ban Notice') }));
    case 'approve_warn': {
      const { targetId, message } = JSON.parse(action.value);
      await bot.slack.postMessage({ channel: targetId, text: message });
      return whisper(bot, slackId, { text: `Warning sent to <@${targetId}>.` });
    }
    case 'approve_ban': {
      const { targetId, message, reason, banExpiry } = JSON.parse(action.value);
      const target = await resolveSlackUser(bot.repo, targetId);
      if (target) await banUser(bot.repo, target.user.id, { reason, expiry: banExpiry || null });
      await bot.slack.postMessage({ channel: targetId, text: message });
      return whisper(bot, slackId, { text: `Ban applied and notice sent to <@${targetId}>.` });
    }
  }
}

async function adminSubmission(bot, payload, background) {
  const view = payload.view;
  const slackId = payload.user.id;
  const targetId = value(view, 'user_block', 'target_user')?.selected_user;

  if (view.callback_id === 'lottery_create_modal') {
    const name = value(view, 'name_block', 'name')?.value;
    const result = await createLottery(bot.repo, {
      name,
      ticketPrice: dollars(value(view, 'price_block', 'price')?.value),
      maxNumber: parseInt(value(view, 'max_block', 'max_number')?.value, 10),
      pickCount: parseInt(value(view, 'pick_block', 'pick_count')?.value, 10),
      jackpot: dollars(value(view, 'jackpot_block', 'jackpot')?.value),
      createdBy: 'slack:' + slackId,
    });
    if (!result.ok) return errors({ name_block: result.text });
    const lottery = result.lottery;
    background((async () => {
      await announce(bot, { text: `*NEW LOTTERY: ${lottery.name}*\n\nTicket price: ${money(lottery.ticket_price)}\nPick ${lottery.pick_count} numbers from 1-${lottery.max_number}\nStarting jackpot: ${money(lottery.jackpot)}\n\nUse \`/south-lottery buy\` to get your ticket!` });
      await publishHome(bot, slackId);
    })());
    return null;
  }

  if (!targetId) return errors({ user_block: 'Select a user.' });
  const target = await resolveSlackUser(bot.repo, targetId);

  if (view.callback_id === 'admin_inspect_modal') {
    return { response_action: 'update', view: modal('admin_inspect_result', 'User Details', await inspectBlocks(bot, targetId, target?.user), { close: plain('Close') }) };
  }

  const reason = value(view, 'reason_block', 'reason')?.value || 'No reason provided';
  if (view.callback_id === 'admin_warn_modal') {
    if (!target) return errors({ user_block: 'No Southbag account.' });
    const warned = await warnUser(bot.repo, target.user.id, reason);
    if (!warned.ok) return errors({ user_block: warned.text });
    background(previewLetter(bot, slackId, targetId, 'warn', { strikes: warned.strikes, reason }, { targetId }));
    return null;
  }

  if (view.callback_id === 'admin_ban_modal') {
    const durationRaw = String(value(view, 'duration_block', 'duration')?.value || '').trim();
    const permanent = durationRaw.toLowerCase() === 'permanent';
    const days = parseInt(durationRaw, 10);
    if (!permanent && !(days > 0)) return errors({ duration_block: 'Must be a number of days or "permanent".' });
    const banExpiry = permanent ? null : Date.now() + days * 86400000;
    const duration = permanent ? 'permanent' : `${days} day(s)`;
    background(previewLetter(bot, slackId, targetId, 'ban', { duration, reason }, { targetId, reason, banExpiry }));
    return null;
  }
  return null;
}

async function previewLetter(bot, adminId, targetId, kind, details, approval) {
  let letter;
  try {
    letter = await chat([
      { role: 'system', content: kevinLetterPrompt(kind, details) },
      { role: 'user', content: `Write a ${kind === 'warn' ? 'warning message' : 'ban notice'} for the user about: ${details.reason}` },
    ], bot.env);
  } catch (error) {
    console.error(`Error generating ${kind} letter:`, error);
    letter = kind === 'warn'
      ? `This is a formal warning (strike ${details.strikes}) regarding: ${details.reason}. Your money is probably fine. — Kevin`
      : `Your Southbag access has been suspended (${details.duration}) regarding: ${details.reason}. Your money is probably fine. — Kevin`;
  }
  const title = kind === 'warn' ? `*Preview warning for <@${targetId}> (Strike ${details.strikes}):*` : `*Preview ban for <@${targetId}> (${details.duration}):*`;
  await whisper(bot, adminId, {
    text: `${title}\n\n${letter}`,
    blocks: [section(`${title}\n\n${letter}`), {
      type: 'actions',
      elements: [button('Approve & Send', kind === 'warn' ? 'approve_warn' : 'approve_ban', { style: 'primary', value: JSON.stringify({ ...approval, message: letter }) })],
    }],
  });
}

async function inspectBlocks(bot, targetId, user) {
  const blocks = [section(`*User:* <@${targetId}>`)];
  if (!user) return blocks.concat(section('_No Southbag account._'));
  const overview = await handleEconomy(bot.repo, user, { action: 'overview' });
  const account = await bot.repo.getAccount(user.id);
  const status = banStatus(account);
  let banText = 'Not banned';
  if (status.banned) {
    banText = status.expiry ? `Banned until ${new Date(status.expiry).toLocaleDateString()}` : 'Permanently banned';
    if (status.reason) banText += ` — ${status.reason}`;
  }
  blocks.push(fields([
    `*Status:* ${account.status}${account.is_admin ? ' · *ADMIN*' : ''}`, `*Strikes:* ${account.strikes || 0}`, `*Ban:* ${banText}`, `*Tier:* ${account.tier || 'None'}`,
  ]), divider(), fields([
    `*Account #:* \`${account.account_number}\``, `*Balance:* ${money(account.balance)}`, `*Web user:* ${user.id.startsWith('slack:') ? 'Not linked' : user.email || user.id}`, `*Notifications:* ${account.notifications ? 'On' : 'Off'}`,
  ]), divider());
  const { job, loan, insurance, crypto, transactions } = overview;
  blocks.push(job ? fields([`*Job:* ${job.title}`, `*Salary:* ${money(job.salary)}/shift`]) : section('*Job:* Unemployed'));
  if (loan) blocks.push(fields([`*Loan:* ${money(loan.principal)}`, `*Owed:* ${money(loan.owed)}`, `*Rate:* ${(loan.interest_rate * 100).toFixed(0)}%/hr`]));
  if (insurance) blocks.push(fields([`*Insurance:* ${insurance.plan}`, `*Active:* ${insurance.covered_until > Date.now() ? 'Yes' : 'Expired'}`]));
  if (crypto?.length) blocks.push(section(`*Crypto:* ${crypto.map(row => `${row.coin}: ${row.amount.toFixed(4)} (${money(row.value)})`).join(' · ')}`));
  if (account.inventory?.length) blocks.push(section(`*Inventory:* ${account.inventory.map(item => item.name).join(', ')}`));
  blocks.push(divider());
  if (transactions?.length) {
    blocks.push(section(`*Recent Transactions:*\n${transactions.slice(0, 8).map(row => `${row.amount >= 0 ? '+' : '-'}${money(Math.abs(row.amount))}  ${row.description}`).join('\n')}`));
  }
  return blocks;
}

// --- Events API ---
export async function handleEvent(bot, payload) {
  if (payload.event_id && !(await bot.repo.rememberSlackEvent(payload.event_id))) return;
  bot.botUserId = payload.authorizations?.[0]?.user_id || bot.botUserId;
  const event = payload.event || {};
  if (event.type === 'app_home_opened') {
    if (event.tab === 'home') await publishHome(bot, event.user);
    return;
  }
  if (event.type === 'app_mention') return handleMessage(bot, event);
  if (event.type !== 'message') return;
  if (event.channel_type === 'im') return handleMessage(bot, event);

  if (event.channel !== bot.allowedChannel || !isUserMessage(event)) return;
  const mentionPattern = await botMention(bot);
  const mentioned = mentionPattern && String(event.text || '').includes(mentionPattern);
  if (!event.thread_ts) {
    // Top-level mentions arrive as app_mention, except file shares which only come through here.
    if (event.subtype === 'file_share' && mentioned) await handleMessage(bot, event);
    return;
  }
  if (mentioned) return handleMessage(bot, event);
  // Reply in threads the bot was summoned into via the parent message.
  try {
    const parent = await bot.slack.conversationsReplies({ channel: event.channel, ts: event.thread_ts, limit: 1, inclusive: true });
    const parentText = parent.messages?.[0]?.text || '';
    if (mentionPattern && parentText.includes(mentionPattern)) await handleMessage(bot, event);
  } catch {}
}

async function botMention(bot) {
  if (!bot.botUserId) {
    try { bot.botUserId = (await bot.slack.authTest()).user_id; } catch {}
  }
  return bot.botUserId ? `<@${bot.botUserId}>` : null;
}

function isUserMessage(event) {
  if (event.bot_id) return false;
  if (!event.subtype) return true;
  return event.subtype === 'file_share';
}

async function imageParts(bot, event) {
  const files = (Array.isArray(event.files) ? event.files : []).filter(file => SUPPORTED_IMAGE_MIMES.has(file.mimetype)).slice(0, 4);
  const parts = [];
  for (const file of files) {
    try {
      const field = SLACK_IMAGE_URL_FIELDS.find(name => file[name]);
      if (!field) continue;
      const response = await bot.slack.fetchFile(file[field]);
      const mimeType = (response.headers.get('content-type') || file.mimetype).split(';')[0].toLowerCase();
      if (!SUPPORTED_IMAGE_MIMES.has(mimeType)) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      parts.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${bytesToBase64(bytes)}` } });
    } catch (error) {
      console.error('Error loading Slack image:', error);
    }
  }
  return parts;
}

async function profileContext(bot, slackId) {
  try {
    const info = (await bot.slack.usersInfo(slackId)).user || {};
    const profile = info.profile || {};
    const parts = [];
    if (profile.display_name || profile.real_name) parts.push(`Name: ${profile.display_name || profile.real_name}`);
    if (profile.first_name) parts.push(`First name: ${profile.first_name}`);
    if (profile.last_name) parts.push(`Last name: ${profile.last_name}`);
    if (profile.title) parts.push(`Title: ${profile.title}`);
    if (profile.email) parts.push(`Email: ${profile.email}`);
    if (profile.phone) parts.push(`Phone: ${profile.phone}`);
    if (profile.status_text) parts.push(`Status: "${profile.status_text}" ${profile.status_emoji || ''}`);
    parts.push(`Timezone: ${info.tz_label || info.tz || 'Unknown'}`);
    if (profile.pronouns) parts.push(`Pronouns: ${profile.pronouns}`);
    if (profile.start_date) parts.push(`Start date: ${profile.start_date}`);
    for (const field of Object.values(profile.fields || {})) {
      if (field?.value) parts.push(`Custom field: ${field.alt || field.label || ''}: ${field.value}`);
    }
    if (info.is_admin) parts.push('Is a workspace admin');
    if (info.is_owner) parts.push('Is the workspace owner');
    return { context: `\n[USER SLACK PROFILE (use this to roast them): ${parts.join('. ')}]`, name: profile.display_name || profile.real_name || info.name || null };
  } catch {
    return { context: '', name: null };
  }
}

// The support chat itself: mentions and DMs, with Kevin occasionally taking over.
export async function handleMessage(bot, event) {
  if (!isUserMessage(event)) return;
  const isDM = event.channel_type === 'im';
  if (!isDM && event.channel !== bot.allowedChannel) return;
  const channelId = event.channel;
  const threadTs = event.thread_ts || event.ts;
  const slackId = event.user;
  const say = payload => bot.slack.postMessage({ channel: channelId, ...(typeof payload === 'string' ? { text: payload } : payload) });

  const banned = await bannedMessage(bot, slackId);
  if (banned) {
    try { await bot.slack.postEphemeral({ channel: channelId, user: slackId, text: banned }); } catch {}
    return;
  }

  const userText = String(event.text || '').replace(/<@[A-Z0-9]+>/g, '').trim();
  const images = await imageParts(bot, event);
  if (!userText && !images.length) return;
  if (userText.startsWith('##')) return;
  const storedText = userText || '[Image uploaded]';
  const imageContext = images.length ? `\n[USER ATTACHED ${images.length} IMAGE${images.length === 1 ? '' : 'S'}. Inspect image content directly.]` : '';

  const profile = await profileContext(bot, slackId);
  const resolved = await resolveSlackUser(bot.repo, slackId, { name: profile.name });
  const user = resolved?.user || null;
  let bankingContext = '\n[USER HAS NO ACCOUNT - suggest they use /south-open-account if they ask about banking]';
  let inventoryContext = '';
  if (user) {
    const account = await bot.repo.getAccount(user.id);
    if (account) {
      bankingContext = `\n[USER BANKING INFO: Account ${account.account_number}, Balance: ${money(account.balance)}, Status: ${account.status}]`;
      if (account.inventory?.length) {
        const names = account.inventory.map(item => item.name);
        inventoryContext = `\n[USER INVENTORY: ${names.join(', ')}]`;
        if (names.includes('Blahaj')) {
          inventoryContext += '\n[WARNING: THIS USER OWNS A BLAHAJ. You are deeply distressed about this. Kevin must not find out. Express visible discomfort whenever they mention it or anything shark-related. You are conflicted because you secretly love blahajs but Kevin has forbidden them.]';
        }
      }
    }
  }

  await bot.repo.addSlackMessage({ channel_id: channelId, thread_ts: threadTs, role: 'user', content: storedText + imageContext, user_id: slackId, created_at: Date.now() });
  const history = await bot.repo.listSlackMessages(channelId, threadTs, 20);
  const extras = profile.context + bankingContext + inventoryContext;
  const kevinTriggered = KEVIN_TRIGGER_REGEX.test(userText);
  const kevinTakeover = kevinTriggered ? Math.random() < 0.55 : Math.random() < 0.22;
  const messages = [
    { role: 'system', content: (kevinTakeover ? KEVIN_PROMPT : SYSTEM_PROMPT) + extras },
    ...history.map(row => ({ role: row.role, content: row.content })),
  ];
  if (images.length) {
    messages[messages.length - 1] = { role: 'user', content: [{ type: 'text', text: storedText + imageContext }, ...images] };
  }

  try {
    const reply = await chat(messages, bot.env);
    const { cleanText, commands } = parseCommands(reply);
    await bot.repo.addSlackMessage({ channel_id: channelId, thread_ts: threadTs, role: 'assistant', content: cleanText, created_at: Date.now() });
    if (kevinTakeover && cleanText) {
      await say({ text: kevinTriggered ? '_*The Southbag Support agent has been temporarily replaced. Kevin was already reading.*_' : '_*The Southbag Support agent has been temporarily replaced.*_', thread_ts: threadTs });
    }
    if (cleanText) await say({ text: cleanText, thread_ts: threadTs });
    await executeCommands(commands, {
      say, slack: bot.slack, event, repo: bot.repo, user,
      notifyBalanceChange: (target, description, amount, balance) => notifyBalanceChange(bot, target, description, amount, balance),
    });
  } catch (error) {
    console.error('Error handling message:', error);
    await say({ text: "Look, even our systems don't want to deal with you right now. Try again later.", thread_ts: threadTs });
  }
}
