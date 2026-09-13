import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiConfigured, chat } from '../ai.js';

const reply = text => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
const fail = status => new Response(JSON.stringify({ error: 'nope' }), { status });

test('uses Hack Club AI when it works', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return reply('hcai says hi'); };
  const text = await chat([{ role: 'user', content: 'hi' }], { HCAI: 'h', OPENROUTER_API_KEY: 'o' }, fetchImpl);
  assert.equal(text, 'hcai says hi');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /ai\.hackclub\.com/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer h');
});

test('falls back to OpenRouter when Hack Club AI fails', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url);
    return /hackclub/.test(url) ? fail(500) : reply('openrouter to the rescue');
  };
  const text = await chat([{ role: 'user', content: 'hi' }], { HCAI: 'h', OPENROUTER_API_KEY: 'o', OPENROUTER_MODEL: 'google/gemini-2.5-flash' }, fetchImpl);
  assert.equal(text, 'openrouter to the rescue');
  assert.equal(calls.length, 2);
  assert.match(calls[1], /openrouter\.ai/);
});

test('falls back when Hack Club AI throws or returns garbage', async () => {
  const fetchImpl = async url => (/hackclub/.test(url) ? new Response('<html>oops</html>', { status: 200 }) : reply('ok'));
  assert.equal(await chat([], { HCAI: 'h', OPENROUTER_API_KEY: 'o' }, fetchImpl), 'ok');
  const throwing = async url => { if (/hackclub/.test(url)) throw new Error('ECONNRESET'); return reply('ok'); };
  assert.equal(await chat([], { HCAI: 'h', OPENROUTER_API_KEY: 'o' }, throwing), 'ok');
});

test('skips unconfigured providers and reports when everything fails', async () => {
  const calls = [];
  const fetchImpl = async url => { calls.push(url); return fail(503); };
  await assert.rejects(chat([], { OPENROUTER_API_KEY: 'o' }, fetchImpl), /All AI providers failed — openrouter: 503/);
  assert.equal(calls.length, 1);
  await assert.rejects(chat([], {}, fetchImpl), /No AI provider is configured/);
  assert.equal(aiConfigured({}), false);
  assert.equal(aiConfigured({ OPENROUTER_API_KEY: 'o' }), true);
});
