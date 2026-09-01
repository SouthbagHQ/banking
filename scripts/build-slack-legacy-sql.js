import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { centsFromDollars } from '../slack-link.js';

const exec = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const defaultZip = '/Users/ingowolf/Downloads/snapshot_capable-raccoon-427_1788220383607296661.zip';
const zipPath = process.argv[2] || defaultZip;
const outPath = process.argv[3] || join(root, 'migrations', '0004_slack_legacy_data.sql');

function sql(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  return `'${String(value).replaceAll(';', ',').replaceAll("'", "''")}'`;
}

function ts(value) {
  if (value == null || value === '') return 'NULL';
  return String(Math.round(Number(value)) || 0);
}

function ints(list) {
  return JSON.stringify((list || []).map(n => Math.round(Number(n))));
}

async function loadJsonl(dir, table) {
  const path = join(dir, table, 'documents.jsonl');
  try {
    const text = await readFile(path, 'utf8');
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeInserts(write, table, columns, rows, chunkSize = 80) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map((row, index) =>
      `  (${row.join(', ')})${index === chunk.length - 1 ? ';' : ','}`).join('\n');
    await write(`INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${values}\n`);
  }
}

async function extractZip(zip) {
  const dir = await mkdtemp(join(tmpdir(), 'southbag-slack-'));
  await exec('unzip', ['-o', zip, '-d', dir]);
  return dir;
}

export async function buildLegacySql({ zip = zipPath, out = outPath } = {}) {
  const dir = await extractZip(zip);
  try {
    const [accounts, transactions, jobs, loans, insurance, crypto, investments, lotteries, tickets, heists] = await Promise.all([
      loadJsonl(dir, 'accounts'),
      loadJsonl(dir, 'transactions'),
      loadJsonl(dir, 'jobs'),
      loadJsonl(dir, 'loans'),
      loadJsonl(dir, 'insurance'),
      loadJsonl(dir, 'cryptoHoldings'),
      loadJsonl(dir, 'investments'),
      loadJsonl(dir, 'lotteries'),
      loadJsonl(dir, 'lotteryTickets'),
      loadJsonl(dir, 'heists'),
    ]);

    await mkdir(dirname(out), { recursive: true });
    const stream = createWriteStream(out);
    const write = chunk => new Promise((resolve, reject) => {
      const ok = stream.write(chunk, error => error ? reject(error) : resolve());
      if (!ok) stream.once('drain', resolve);
    });

    await write('-- Generated from the Slack-bot Convex snapshot. Do not edit by hand.\n');
    await write('PRAGMA foreign_keys = OFF;\n\n');

    await writeInserts(write, 'slack_legacy_accounts', [
      'slack_user_id', 'name', 'account_number', 'balance', 'status', 'tier', 'inventory',
      'last_daily_at', 'last_beg_at', 'last_fee_at', 'notifications', 'strikes', 'created_at',
    ], accounts.map(row => [
      sql(row.userId),
      sql(row.name || null),
      sql(row.accountNumber || null),
      sql(centsFromDollars(row.balance)),
      sql(row.isBanned ? 'frozen' : (row.status || 'active')),
      sql(row.tier || null),
      sql('[]'),
      ts(row.lastDailyAt),
      ts(row.lastBegAt),
      ts(row.lastFeeAt),
      sql(row.notifications ? 1 : 0),
      sql(Math.round(Number(row.strikes) || 0)),
      ts(row.createdAt || row._creationTime),
    ]), 1);

    await writeInserts(write, 'slack_legacy_inventory', [
      'slack_user_id', 'item_id', 'name', 'bought_at',
    ], accounts.flatMap(row => (row.inventory || []).map(item => [
      sql(row.userId),
      sql(item.itemId || item.id || 'unknown'),
      sql(item.name || item.itemId || 'Unknown item'),
      ts(item.boughtAt),
    ])));

    await writeInserts(write, 'slack_legacy_transactions', [
      'slack_user_id', 'amount', 'kind', 'description', 'created_at',
    ], transactions.map(row => [
      sql(row.userId),
      sql(centsFromDollars(row.amount)),
      sql(row.type || 'fee'),
      sql(String(row.description || 'Unknown Slack fee').slice(0, 200)),
      ts(row.createdAt || row._creationTime),
    ]));

    await writeInserts(write, 'slack_legacy_jobs', [
      'slack_user_id', 'title', 'salary', 'hired_at', 'last_worked_at',
    ], jobs.map(row => [
      sql(row.userId),
      sql(row.title),
      sql(centsFromDollars(row.salary)),
      ts(row.hiredAt),
      ts(row.lastWorkedAt || 0),
    ]));

    await writeInserts(write, 'slack_legacy_loans', [
      'slack_user_id', 'principal', 'interest_rate', 'total_owed', 'taken_at', 'last_interest_at', 'status',
    ], loans.map(row => [
      sql(row.userId),
      sql(centsFromDollars(row.principal)),
      sql(Number(row.interestRate) || 0),
      sql(centsFromDollars(row.totalOwed)),
      ts(row.takenAt),
      ts(row.lastInterestAt),
      sql(row.status || 'active'),
    ]));

    await writeInserts(write, 'slack_legacy_insurance', [
      'slack_user_id', 'plan', 'premium', 'covered_until', 'created_at',
    ], insurance.map(row => [
      sql(row.userId),
      sql(row.plan),
      sql(centsFromDollars(row.premium)),
      ts(row.coveredUntil),
      ts(row.createdAt),
    ]));

    await writeInserts(write, 'slack_legacy_crypto', [
      'slack_user_id', 'coin', 'amount', 'bought_at', 'created_at',
    ], crypto.map(row => [
      sql(row.userId),
      sql(row.coin),
      sql(Number(row.amount) || 0),
      sql(centsFromDollars(row.boughtAt) || Math.round(Number(row.boughtAt) || 0)),
      ts(row.createdAt),
    ]));

    await writeInserts(write, 'slack_legacy_investments', [
      'slack_user_id', 'amount', 'multiplier', 'matures_at', 'status', 'created_at',
    ], investments.map(row => [
      sql(row.userId),
      sql(centsFromDollars(row.amount)),
      sql(Number(row.multiplier) || 0),
      ts(row.maturesAt),
      sql(row.status || 'active'),
      ts(row.createdAt),
    ]));

    await writeInserts(write, 'lotteries', [
      'name', 'ticket_price', 'max_number', 'pick_count', 'jackpot', 'status', 'winning_numbers',
      'created_at', 'drawn_at', 'legacy_id', 'created_by', 'winner_id',
    ], lotteries.map(row => [
      sql(row.name),
      sql(centsFromDollars(row.ticketPrice)),
      sql(Math.round(Number(row.maxNumber) || 0)),
      sql(Math.round(Number(row.pickCount) || 0)),
      sql(centsFromDollars(row.jackpot)),
      sql(row.status || 'drawn'),
      row.winningNumbers ? sql(ints(row.winningNumbers)) : 'NULL',
      ts(row.createdAt),
      ts(row.drawnAt),
      sql(row._id),
      sql(row.createdBy || null),
      sql(row.winnerId || null),
    ]));

    await writeInserts(write, 'slack_legacy_lottery_tickets', [
      'slack_user_id', 'lottery_legacy_id', 'numbers', 'created_at',
    ], tickets.map(row => [
      sql(row.userId),
      sql(row.lotteryId),
      sql(ints(row.numbers)),
      ts(row.createdAt),
    ]));

    await writeInserts(write, 'heists', [
      'channel_id', 'started_by', 'participants', 'status', 'created_at', 'completed_at',
    ], heists.map(row => [
      sql(row.channelId),
      sql(row.startedBy),
      sql(JSON.stringify(row.participants || [])),
      sql(row.status || 'completed'),
      ts(row.createdAt),
      ts(row.completedAt),
    ]));

    await write('\nPRAGMA foreign_keys = ON;\n');
    await new Promise((resolve, reject) => stream.end(error => error ? reject(error) : resolve()));
    return { out, accounts: accounts.length, transactions: transactions.length };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildLegacySql();
  console.log(`Wrote ${result.out} (${result.accounts} accounts, ${result.transactions} transactions)`);
}
