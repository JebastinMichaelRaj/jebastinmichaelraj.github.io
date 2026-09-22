import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMailer } from './mail.mjs';
const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const mailer = await createMailer(process.env);
if (!mailer) {
  console.error('Add GMAIL_USER, GMAIL_APP_PASSWORD, and CONTACT_TO to your private .env file first.');
  process.exitCode = 1;
} else {
  try {
    await mailer.verify();
    console.log('SMTP authentication succeeded. No email was sent. Submit the website form and check the receiving inbox to verify delivery.');
  } catch (error) {
    console.error('SMTP authentication failed:', error.code || 'MAIL_ERROR');
    process.exitCode = 1;
  } finally { mailer.close(); }
}
