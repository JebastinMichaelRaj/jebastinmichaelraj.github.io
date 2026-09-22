import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import nodemailer from 'nodemailer';
import { createApp } from '../server/server.mjs';

const valid = { name: 'Test Visitor', email: 'visitor@example.test', subject: 'Project collaboration', message: 'A local test message. No external delivery.', website: '' };
const env = { GMAIL_USER: 'owner@example.test', CONTACT_TO: 'inbox@example.test', NODE_ENV: 'development' };
async function app(t, mailer, overrides = {}) {
  const server = createApp({ env: { ...env, ...overrides }, mailer, logger: { error() {} } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const origin = 'http://127.0.0.1:' + server.address().port;
  return { origin, post: (value = valid, extra = {}) => fetch(origin + '/api/contact', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...extra }, body: typeof value === 'string' ? value : JSON.stringify(value) }) };
}

test('unconfigured mail is unavailable; it never reports a successful send', async t => {
  const a = await app(t, null);
  assert.deepEqual(await (await fetch(a.origin + '/api/contact/status')).json(), { configured: false });
  const response = await a.post(); assert.equal(response.status, 503); assert.equal((await response.json()).ok, false);
});
test('SMTP acceptance is required; recipient and sender are server-controlled', async t => {
  const messages = [];
  const a = await app(t, { async sendMail(message) { messages.push(message); return { accepted: [env.CONTACT_TO] }; } });
  const response = await a.post({ ...valid, to: 'attacker@example.test', from: 'spoof@example.test' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, delivery: 'accepted' });
  assert.equal(messages[0].to, env.CONTACT_TO); assert.equal(messages[0].from.address, env.GMAIL_USER);
  assert.equal(messages[0].replyTo.address, valid.email); assert.ok(messages[0].text.includes(valid.message));
});
test('SMTP rejection and exceptions return errors without leaking credentials', async t => {
  for (const mailer of [{ async sendMail() { return { accepted: [] }; } }, { async sendMail() { throw Object.assign(new Error('private-secret'), { code: 'EAUTH' }); } }]) {
    const a = await app(t, mailer); const response = await a.post();
    assert.equal(response.status, 502); const text = await response.text(); assert.ok(!text.includes('private-secret')); assert.equal(JSON.parse(text).ok, false);
  }
});
test('invalid fields, header injection, honeypots and malformed JSON cannot send mail', async t => {
  let sends = 0;
  for (const value of [
    { ...valid, name: 'A' }, { ...valid, email: 'not-an-email' }, { ...valid, name: 'Someone\r\nBcc: spam@example.test' },
    { ...valid, message: 'short' }, { ...valid, message: 'x'.repeat(5001) }, { ...valid, subject: 'unrecognized' },
    { ...valid, website: 'bot.example' }, { ...valid, email: ['visitor@example.test'] }, '{broken', null
  ]) {
    const a = await app(t, { async sendMail() { sends++; } });
    assert.equal((await a.post(value)).status, 400);
  }
  assert.equal(sends, 0);
});
test('cross-origin, unsupported types, large bodies and incorrect methods are rejected', async t => {
  let sends = 0; const a = await app(t, { async sendMail() { sends++; } });
  assert.equal((await a.post(valid, { Origin: 'https://untrusted.example' })).status, 403);
  assert.equal((await a.post(valid, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await a.post('x'.repeat(26000))).status, 413);
  assert.equal((await fetch(a.origin + '/api/contact')).status, 405);
  assert.equal(sends, 0);
});
test('rate limiting allows five attempts then blocks the sixth', async t => {
  let sends = 0; const a = await app(t, { async sendMail() { sends++; return { accepted: [env.CONTACT_TO] }; } });
  for (let i = 0; i < 5; i++) assert.equal((await a.post()).status, 200);
  const response = await a.post(); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '900'); assert.equal(sends, 5);
});
test('production fails closed without an explicit HTTPS site origin', async t => {
  const a = await app(t, { async sendMail() {} }, { NODE_ENV: 'production' });
  assert.equal((await (await fetch(a.origin + '/api/contact/status')).json()).configured, false);
  assert.equal((await a.post()).status, 403);
});
test('exact separate frontend origin supports CORS, with no wildcard access', async t => {
  const a = await app(t, { async sendMail() { return { accepted: [env.CONTACT_TO] }; } }, { NODE_ENV: 'production', SITE_ORIGIN: 'https://api.example.test', ALLOWED_ORIGIN: 'https://portfolio.example.test' });
  const r = await fetch(a.origin + '/api/contact', { method: 'OPTIONS', headers: { Origin: 'https://portfolio.example.test' } });
  assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), 'https://portfolio.example.test');
  assert.equal((await a.post(valid, { Origin: 'https://portfolio.example.test' })).status, 200);
  assert.equal((await a.post(valid, { Origin: 'https://portfolio.example.test.evil.test' })).status, 403);
});
test('static handler blocks secrets, server files and path traversal', async t => {
  const a = await app(t, null);
  for (const resource of ['/.env', '/server/server.mjs', '/package.json', '/tests/contact.test.mjs', '/assets/%2e%2e%2fserver/server.mjs', '/assets/%2eenv']) {
    assert.equal((await fetch(a.origin + resource)).status, 404, resource);
  }
  const homepage = await fetch(a.origin); assert.equal(homepage.status, 200);
  assert.ok((await homepage.text()).includes('name="portfolio-api-base"'));
  assert.equal((await fetch(a.origin + '/assets/js/main.js')).status, 200);
});
test('real Nodemailer SMTP flow succeeds against a loopback-only SMTP fixture', async t => {
  let captured = '';
  const smtp = net.createServer(socket => {
    socket.write('220 localhost test SMTP\r\n'); let buffer = '', inData = false;
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const at = buffer.indexOf('\r\n'); const line = buffer.slice(0, at); buffer = buffer.slice(at + 2);
        if (inData) {
          if (line === '.') { inData = false; socket.write('250 Queued locally\r\n'); }
          else captured += line + '\n';
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250-localhost\r\n250 PIPELINING\r\n');
        else if (/^(MAIL FROM|RCPT TO)/.test(line)) socket.write('250 OK\r\n');
        else if (line === 'DATA') { inData = true; socket.write('354 Send data\r\n'); }
        else if (line === 'QUIT') socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => smtp.close(resolve)));
  const mailer = nodemailer.createTransport({ host: '127.0.0.1', port: smtp.address().port, secure: false, ignoreTLS: true });
  t.after(() => mailer.close());
  const a = await app(t, mailer); assert.equal((await a.post()).status, 200);
  assert.ok(captured.includes('Reply-To: Test Visitor <visitor@example.test>'));
  assert.ok(captured.includes('To: inbox@example.test'));
  assert.ok(captured.includes(valid.message));
});
