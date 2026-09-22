import http from 'node:http';
import { readFile, stat, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMailer } from './mail.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPICS = new Set(['Job opportunity', 'Project collaboration', 'Freelance project', 'Just saying hello']);
const MAX_BYTES = 24576;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

export function validateContact(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { name, email, subject, message, website = '' } = value;
  if (![name, email, subject, message, website].every(item => typeof item === 'string')) return null;
  const result = { name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), website: website.trim() };
  if (result.name.length < 2 || result.name.length > 80 || /[\x00-\x1f\x7f]/.test(result.name)) return null;
  if (result.email.length > 254 || !EMAIL.test(result.email) || /[\x00-\x1f\x7f]/.test(result.email)) return null;
  if (!TOPICS.has(result.subject)) return null;
  if (result.message.length < 10 || result.message.length > 5000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(result.message)) return null;
  return result;
}

function json(res, code, value, extra = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(value));
}

export function createApp({ env = process.env, mailer = null, root = ROOT, logger = console } = {}) {
  const attempts = new Map();
  const globalAttempts = [];
  let active = 0;
  const recipient = env.CONTACT_TO || env.GMAIL_USER;
  const production = env.NODE_ENV === 'production';
  const validOrigin = value => {
    try { const url = new URL(value); return url.origin === value && (url.protocol === 'https:' || (!production && url.protocol === 'http:')); } catch { return false; }
  };
  const configured = Boolean(mailer && EMAIL.test(recipient || '') && EMAIL.test(env.GMAIL_USER || '') && (!production || validOrigin(env.SITE_ORIGIN)));
  const assetsRoot = path.join(root, 'assets');
  function allowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin || origin === 'null') return false;
    if (validOrigin(env.SITE_ORIGIN) && origin === env.SITE_ORIGIN) return true;
    if (validOrigin(env.ALLOWED_ORIGIN) && origin === env.ALLOWED_ORIGIN) return true;
    if (!production && /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(req.headers.host || '')) return origin === 'http://' + req.headers.host;
    return false;
  }
  function throttled(req) {
    const now = Date.now();
    const key = env.TRUST_PROXY === 'true' && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim().slice(0,100) : req.socket.remoteAddress;
    for (const [id, entry] of attempts) if (entry.expires <= now) attempts.delete(id);
    while (globalAttempts.length && globalAttempts[0] <= now - 3600000) globalAttempts.shift();
    if (globalAttempts.length >= 100 || active >= 3) return true;
    const entry = attempts.get(key) || { count: 0, expires: now + 900000 };
    if (entry.count >= 5 || (!attempts.has(key) && attempts.size >= 10000)) return true;
    entry.count++; attempts.set(key, entry); globalAttempts.push(now);
    return false;
  }
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // The UI uses JS-set transform styles; all executable scripts remain local.
    const connect = validOrigin(env.ALLOWED_ORIGIN) ? ' ' + env.ALLOWED_ORIGIN : '';
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'" + connect + "; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) {
        const permitted = allowedOrigin(req);
        if (permitted) { res.setHeader('Access-Control-Allow-Origin', req.headers.origin); res.setHeader('Vary', 'Origin'); }
        if (req.method === 'OPTIONS') {
          if (!permitted) return json(res, 403, { ok: false, message: 'Origin not allowed.' });
          res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end();
        }
        if (url.pathname === '/api/contact/status' && req.method === 'GET') return json(res, 200, { configured });
        if (url.pathname !== '/api/contact') return json(res, 404, { ok: false, message: 'Not found.' });
        if (req.method !== 'POST') return json(res, 405, { ok: false, message: 'Use POST.' }, { Allow: 'POST' });
        if (!permitted) return json(res, 403, { ok: false, message: 'This website is not allowed to send messages.' });
        if (!configured) return json(res, 503, { ok: false, message: 'The contact form is temporarily unavailable. Please use the email link below.' });
        if (throttled(req)) return json(res, 429, { ok: false, message: 'Too many attempts. Please wait 15 minutes or use the email link below.' }, { 'Retry-After': '900' });
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res, 415, { ok: false, message: 'Expected JSON.' });
        if (Number(req.headers['content-length']) > MAX_BYTES) return json(res, 413, { ok: false, message: 'This message is too large.' });
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > MAX_BYTES) { json(res, 413, { ok: false, message: 'This message is too large.' }); return; }
          chunks.push(chunk);
        }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return json(res, 400, { ok: false, message: 'Invalid message format.' }); }
        const data = validateContact(body);
        if (!data) return json(res, 400, { ok: false, message: 'Check your name, email, topic, and message length.' });
        if (data.website) return json(res, 400, { ok: false, message: 'This message could not be submitted.' });
        if (active >= 3) return json(res, 429, { ok: false, message: 'The contact form is busy. Please try again shortly.' }, { 'Retry-After': '30' });
        active++;
        try {
          const result = await mailer.sendMail({
            from: { name: 'Jebastin Portfolio', address: env.GMAIL_USER },
            to: recipient,
            replyTo: { name: data.name, address: data.email },
            subject: '[Portfolio] ' + data.subject,
            text: 'New portfolio message\n\nName: ' + data.name + '\nEmail: ' + data.email + '\nTopic: ' + data.subject + '\n\n' + data.message,
            disableFileAccess: true, disableUrlAccess: true
          });
          const accepted = (result.accepted || []).some(address => String(address).toLowerCase() === recipient.toLowerCase());
          if (!accepted) throw Object.assign(new Error('Recipient not accepted'), { code: 'ENOTACCEPTED' });
          return json(res, 200, { ok: true, delivery: 'accepted' });
        } catch (error) {
          logger.error('Contact delivery failed:', typeof error.code === 'string' ? error.code : 'MAIL_ERROR');
          return json(res, 502, { ok: false, message: 'Email delivery could not be confirmed. Your message is still here. Please wait before retrying, or use the email link below.' });
        } finally { active--; }
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { ok: false, message: 'Method not allowed.' }, { Allow: 'GET, HEAD' });
      let decoded;
      try { decoded = decodeURIComponent(url.pathname); } catch { return json(res, 400, { ok: false, message: 'Invalid path.' }); }
      const isIndex = decoded === '/' || decoded === '/index.html';
      // Serve ONLY the document and assets. .env, server code and tests are private.
      if (!isIndex && (!decoded.startsWith('/assets/') || decoded.split('/').some(part => part.startsWith('.')) || decoded.includes('\\') || decoded.includes('\0'))) return json(res, 404, { ok: false, message: 'Not found.' });
      const candidate = isIndex ? path.join(root, 'index.html') : path.resolve(root, '.' + decoded);
      const resolved = await realpath(candidate);
      if (!isIndex && !resolved.startsWith(assetsRoot + path.sep)) return json(res, 404, { ok: false, message: 'Not found.' });
      const info = await stat(resolved);
      if (!info.isFile()) return json(res, 404, { ok: false, message: 'Not found.' });
      let bytes = await readFile(resolved);
      if (isIndex) bytes = Buffer.from(bytes.toString().replace('</head>', '<meta name="portfolio-api-base" content="same-origin">\n</head>'));
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(resolved).toLowerCase()] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=3600' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return json(res, 404, { ok: false, message: 'Not found.' });
      logger.error('Request failed:', error.code || 'REQUEST_ERROR');
      json(res, 500, { ok: false, message: 'The request could not be completed.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const mailer = await createMailer(process.env);
  const server = createApp({ mailer });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  const port = Number(process.env.PORT || 3000);
  server.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log('Portfolio running on port ' + port + '.');
    console.log(mailer ? 'SMTP configured. Run npm run verify-email to check authentication.' : 'Contact email is not configured. Copy .env.example to .env and add private Gmail settings.');
  });
}
