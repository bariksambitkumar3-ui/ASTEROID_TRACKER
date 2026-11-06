// vite-plugin-email.js
// Server-side middleware plugin for Vite.
// Handles sending email notifications directly via Gmail SMTP (Nodemailer)
// when users register or authenticate into ASTRA.
// Credentials (GMAIL_USER, GMAIL_APP_PASSWORD) stay safely on the server.

import { Buffer } from 'node:buffer';
import nodemailer from 'nodemailer';

/** Read the full request body helper */
async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Send JSON response helper */
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Create Gmail SMTP transporter using App Password
 */
function getGmailTransporter() {
  const user = process.env.GMAIL_USER ? process.env.GMAIL_USER.trim() : '';
  const pass = process.env.GMAIL_APP_PASSWORD
    ? process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '').trim()
    : '';

  if (!user || !pass) {
    return null;
  }

  return {
    user,
    transporter: nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user,
        pass,
      },
    }),
  };
}

/**
 * Send Welcome / Registration Confirmation Email
 */
async function sendRegistrationEmail({ to_email, to_name }) {
  const config = getGmailTransporter();
  if (!config) {
    console.warn('[ASTRA Gmail] GMAIL_USER/GMAIL_APP_PASSWORD not set in .env. Skipping registration email.');
    return { success: false, reason: 'GMAIL_NOT_CONFIGURED' };
  }

  const { user, transporter } = config;
  const now = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const html = `
    <div style="background-color: #04060a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 52px; height: 52px; line-height: 52px; border-radius: 50%; background: #000; border: 1px solid #10b981; color: #10b981; font-size: 26px; box-shadow: 0 0 20px rgba(16,185,129,0.3);">
          ☄️
        </div>
        <h1 style="color: #ffffff; font-size: 24px; margin: 12px 0 4px 0; letter-spacing: 2px;">ASTRA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">3D Solar System & Asteroid Explorer</p>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="color: #10b981; font-size: 20px;">🎉</span>
          <h2 style="color: #ffffff; font-size: 18px; margin: 0;">Registration Successful!</h2>
        </div>

        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Hello <strong>${to_name || 'Explorer'}</strong>,<br/><br/>
          You have successfully registered your account with <strong>ASTRA – Asteroid Tracker</strong>. You now have full access to real-time Near-Earth Object telemetry, 3D solar system exploration, and planetary defense monitoring.
        </p>

        <div style="background: rgba(0,0,0,0.4); border-left: 3px solid #10b981; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Registered Account:</p>
          <p style="margin: 0 0 8px 0; color: #34d399; font-size: 14px; font-family: monospace;">${to_email}</p>
          <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Registration Time:</p>
          <p style="margin: 0; color: #f1f5f9; font-size: 13px; font-family: monospace;">${now}</p>
        </div>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
          Welcome aboard! You can now explore the dashboard, track potentially hazardous asteroids, and inspect planetary orbits in 3D.
        </p>
      </div>

      <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 24px;">
        ASTRA Security Center · Real-time Planetary Defense System 🚀
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ASTRA Security" <${user}>`,
      to: to_email,
      subject: 'ASTRA – Account Registration Confirmation',
      text: `Welcome to ASTRA, ${to_name || 'Explorer'}! Your account has been registered successfully.`,
      html,
    });
    console.log(`[ASTRA Gmail] Registration confirmation delivered to ${to_email}`);
    return { success: true };
  } catch (err) {
    console.error('[ASTRA Gmail] Error delivering registration email:', err.message);
    return { success: false, reason: err.message };
  }
}

/**
 * Send Login Notification Email via Gmail SMTP
 */
async function sendLoginAlertEmail({ to_email, to_name }) {
  const config = getGmailTransporter();
  if (!config) return { success: false };

  const { user, transporter } = config;
  const now = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const html = `
    <div style="background-color: #04060a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1);">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 50%; background: #000; border: 1px solid #10b981; color: #10b981; font-size: 24px;">
          🛰️
        </div>
        <h1 style="color: #ffffff; font-size: 24px; margin: 12px 0 4px 0; letter-spacing: 2px;">ASTRA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 0;">Planetary Defense & Real-Time Tracking</p>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
          <span style="color: #10b981; font-size: 18px;">✅</span>
          <h2 style="color: #ffffff; font-size: 17px; margin: 0;">Successful Authentication Notice</h2>
        </div>

        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          Hello <strong>${to_name || 'Explorer'}</strong>,<br/><br/>
          You have successfully authenticated into the <strong>ASTRA Asteroid Tracker</strong> dashboard.
        </p>

        <div style="background: rgba(0,0,0,0.4); border-left: 3px solid #10b981; padding: 12px 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 4px 0; color: #94a3b8; font-size: 12px;">Authentication Timestamp:</p>
          <p style="margin: 0; color: #f1f5f9; font-size: 13px; font-family: monospace;">${now}</p>
        </div>

        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 12px; margin-top: 16px;">
          <p style="color: #fca5a5; font-size: 12px; margin: 0; line-height: 1.5;">
            ⚠️ <strong>Was this not you?</strong> If you did not log in, someone may have compromised your password. Please secure your account immediately.
          </p>
        </div>
      </div>

      <p style="color: #64748b; font-size: 11px; text-align: center; margin-top: 24px;">
        ASTRA Security Center · Real-time Planetary Defense System 🚀
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ASTRA Security" <${user}>`,
      to: to_email,
      subject: 'ASTRA – Successful Authentication Notice',
      text: `Hello ${to_name || 'Explorer'}, you have successfully authenticated into ASTRA Asteroid Tracker at ${now}.`,
      html,
    });
    console.log(`[ASTRA Gmail] Login notification delivered to ${to_email}`);
    return { success: true };
  } catch (err) {
    console.error('[ASTRA Gmail] Error delivering login alert:', err.message);
    return { success: false, reason: err.message };
  }
}

export function emailPlugin() {
  return {
    name: 'astra-email-notifications',

    configureServer(server) {
      // ── POST /api/auth/send-registration-notification ───────────────────
      server.middlewares.use('/api/auth/send-registration-notification', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

        let body;
        try { body = JSON.parse(await readBody(req)); }
        catch { json(res, 400, { error: 'Invalid JSON' }); return; }

        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || '').trim();

        if (!email) { json(res, 400, { error: 'Email required' }); return; }

        // Send registration confirmation email
        const result = await sendRegistrationEmail({
          to_email: email,
          to_name: name || email.split('@')[0],
        });

        json(res, 200, { success: result.success });
      });

      // ── POST /api/auth/send-login-notification ───────────────────────────
      server.middlewares.use('/api/auth/send-login-notification', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed' }); return; }

        let body;
        try { body = JSON.parse(await readBody(req)); }
        catch { json(res, 400, { error: 'Invalid JSON' }); return; }

        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || '').trim();

        if (!email) { json(res, 400, { error: 'Email required' }); return; }

        // Send login alert in the background
        await sendLoginAlertEmail({
          to_email: email,
          to_name: name || email.split('@')[0],
        });

        json(res, 200, { success: true });
      });
    },
  };
}
