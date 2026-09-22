export function mailConfigured(env) {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return email.test(env.GMAIL_USER || '') && Boolean(env.GMAIL_APP_PASSWORD?.trim()) && email.test(env.CONTACT_TO || env.GMAIL_USER || '');
}

export async function createMailer(env) {
  if (!mailConfigured(env)) return null;
  const { default: nodemailer } = await import('nodemailer');
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, '') },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    dnsTimeout: 5000, disableFileAccess: true, disableUrlAccess: true,
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  });
}
