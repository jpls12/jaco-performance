const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const authSource = fs.readFileSync('api/_app-auth.js', 'utf8')
  .replace(/^import .*;\n/, '')
  .replace(/^export /gm, '');
const endpointSource = fs.readFileSync('api/app-session.js', 'utf8')
  .replace(/^import .*;\n/, '')
  .replace('export default async function handler', 'async function handler');

function setup() {
  const context = vm.createContext({
    ...crypto, Buffer, Date,
    process: { env: { INTERVALS_API_KEY: 'long-secret-key', JACO_APP_PIN: '1234' } }
  });
  vm.runInContext(authSource + '\n' + endpointSource, context);
  return context;
}

function response() {
  return { headers: {}, status(code) { this.code = code; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = JSON.parse(body); return this; } };
}

test('sign in creates a secure, opaque 30 day cookie; tampering and secret rotation invalidate it', async () => {
  const ctx = setup();
  const denied = response();
  await ctx.handler({ method: 'POST', body: { pin: 'wrong' } }, denied);
  assert.equal(denied.code, 401);
  assert.equal(denied.headers['Set-Cookie'], undefined);

  const signedIn = response();
  await ctx.handler({ method: 'POST', body: { pin: '1234' } }, signedIn);
  const cookie = signedIn.headers['Set-Cookie'];
  assert.equal(signedIn.code, 200);
  assert.match(cookie, /Max-Age=2592000; Path=\/api; HttpOnly; Secure; SameSite=Strict/);
  assert.doesNotMatch(cookie, /1234|long-secret-key/);
  const token = cookie.split(';')[0];
  assert.equal(ctx.validAppSession({ headers: { cookie: token } }), true);
  const last = token.at(-1);
  const tampered = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
  assert.equal(ctx.validAppSession({ headers: { cookie: tampered } }), false);
  assert.equal(ctx.authorizedAppRequest({ headers: { cookie: token } }), true);
  ctx.process.env.JACO_APP_PIN = '9876';
  assert.equal(ctx.validAppSession({ headers: { cookie: token } }), false);
  ctx.process.env.JACO_APP_PIN = '1234';

  const signedOut = response();
  await ctx.handler({ method: 'DELETE' }, signedOut);
  assert.equal(signedOut.code, 200);
  assert.match(signedOut.headers['Set-Cookie'], /Max-Age=0/);
  assert.equal(signedOut.headers['Cache-Control'], 'no-store');
});

test('simultaneous protected requests ask for the PIN once and then reuse the cookie', async () => {
  const source = fs.readFileSync('js/app.js', 'utf8');
  const code = source.slice(source.indexOf('function promptForAppPin('), source.indexOf('\nfunction ', source.indexOf('async function signOutAppSession(') + 1));
  let authorized = false;
  let prompts = 0;
  const context = vm.createContext({
    prompt: () => { prompts++; return '1234'; },
    fetch: async (url, options) => {
      if (url === '/api/app-session' && options.method === 'POST') {
        authorized = true;
        return { ok: true, status: 200 };
      }
      return { ok: authorized, status: authorized ? 200 : 401 };
    },
    document: {}, Error
  });
  vm.runInContext(code, context);
  const results = await Promise.all([
    context.fetchWithAppPin('/api/intervals-status'),
    context.fetchWithAppPin('/api/intervals-activities')
  ]);
  assert.ok(results.every(result => result.ok));
  assert.equal(prompts, 1);
  assert.equal((await context.fetchWithAppPin('/api/intervals-status')).status, 200);
  assert.equal(prompts, 1);
});
