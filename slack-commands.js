import { handleEconomy, money } from './economy.js';

// The AI can embed [COMMANDS] in its replies. Strip them out and return them as actions.
export function parseCommands(text) {
  const commands = [];
  let cleanText = String(text || '');

  const redirectMatch = cleanText.match(/\[REDIRECT:(.*?)\]/);
  if (redirectMatch) {
    commands.push({ type: 'redirect', url: redirectMatch[1] });
    cleanText = cleanText.replace(redirectMatch[0], '').trim();
  }
  const holdMatch = cleanText.match(/\[HOLD:(\d+)\]/);
  if (holdMatch) {
    commands.push({ type: 'hold', seconds: Math.min(parseInt(holdMatch[1], 10), 120) });
    cleanText = cleanText.replace(holdMatch[0], '').trim();
  }
  if (cleanText.includes('[DISCONNECT]')) {
    commands.push({ type: 'disconnect' });
    cleanText = cleanText.replace('[DISCONNECT]', '').trim();
  }
  const popupMatch = cleanText.match(/\[POPUP:(.*?)\]/);
  if (popupMatch) {
    commands.push({ type: 'popup', message: popupMatch[1] });
    cleanText = cleanText.replace(popupMatch[0], '').trim();
  }
  for (const simple of ['shake', 'glitch', 'confetti']) {
    const tag = `[${simple.toUpperCase()}]`;
    if (cleanText.includes(tag)) {
      commands.push({ type: simple });
      cleanText = cleanText.replace(tag, '').trim();
    }
  }
  const ticketMatch = cleanText.match(/\[TICKET:(\d+)\]/);
  if (ticketMatch) {
    commands.push({ type: 'ticket', number: ticketMatch[1] });
    cleanText = cleanText.replace(ticketMatch[0], '').trim();
  }
  if (cleanText.includes('[SLOWTYPE]')) cleanText = cleanText.replace('[SLOWTYPE]', '').trim();
  const volumeMatch = cleanText.match(/\[VOLUME:(.*?)\]/);
  if (volumeMatch) {
    commands.push({ type: 'volume', level: volumeMatch[1] });
    cleanText = cleanText.replace(volumeMatch[0], '').trim();
  }
  const feeMatch = cleanText.match(/\[FEE:([\d.]+):(.*?)\]/);
  if (feeMatch) {
    const amount = Math.min(Math.max(parseFloat(feeMatch[1]) || 0.01, 0.01), 100000);
    commands.push({ type: 'fee', amount, reason: feeMatch[2] });
    cleanText = cleanText.replace(feeMatch[0], '').trim();
  }
  return { cleanText, commands };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// `event` needs channel, user (Slack id), ts and optionally thread_ts. `user` is the D1 user (or null).
export async function executeCommands(commands, { say, slack, event, repo, user, notifyBalanceChange }) {
  const threadTs = event.thread_ts || event.ts;
  const react = async name => {
    try { await slack.addReaction({ channel: event.channel, name, timestamp: event.ts }); } catch {}
  };
  for (const cmd of commands) {
    try {
      switch (cmd.type) {
        case 'redirect':
          await say({ text: `The agent is redirecting you to: ${cmd.url}`, thread_ts: threadTs });
          break;
        case 'hold':
          await say({ text: '_Please hold... the agent is consulting their will to live._', thread_ts: threadTs });
          await sleep(Math.min(cmd.seconds, 30) * 1000);
          break;
        case 'disconnect':
          await say({ text: '*Connection lost.* The agent has disconnected.', thread_ts: threadTs });
          await react('no_entry');
          break;
        case 'popup':
          try {
            await slack.postEphemeral({ channel: event.channel, user: event.user, text: `⚠️ ALERT: ${cmd.message}` });
          } catch {
            await say({ text: `⚠️ ALERT: ${cmd.message}`, thread_ts: threadTs });
          }
          break;
        case 'shake':
        case 'glitch':
          await react('warning');
          await say({ text: cmd.type === 'shake' ? '_* screen shakes violently *_' : '_* screen glitches *_', thread_ts: threadTs });
          break;
        case 'confetti':
          await react('tada');
          break;
        case 'ticket':
          await say({ text: `───────────────\n*SUPPORT TICKET*\n*#${cmd.number}*\nEst. response: Never\n───────────────`, thread_ts: threadTs });
          break;
        case 'volume':
          await react('loud_sound');
          break;
        case 'fee':
          if (repo && user) {
            const result = await handleEconomy(repo, user, { action: 'fee', amount: cmd.amount, reason: cmd.reason });
            if (result.ok) {
              const cents = Math.round(cmd.amount * 100);
              if (notifyBalanceChange) await notifyBalanceChange(user, cmd.reason, -cents, result.balance);
              await say({ text: `_You've been charged ${money(cents)} for: ${cmd.reason}_`, thread_ts: threadTs });
            }
          }
          break;
      }
    } catch (error) {
      console.error(`Error executing command ${cmd.type}:`, error);
    }
  }
}
