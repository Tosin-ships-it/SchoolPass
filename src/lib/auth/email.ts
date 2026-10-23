import 'server-only';
import { after } from 'next/server.js';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logEvent } from '@/lib/logging';

export interface SendWelcomeEmailParams {
  to: string;
  name?: string;
  userId?: string;
  actorType?: 'parent' | 'staff' | 'admin';
}

export interface SendVerificationEmailParams {
  to: string;
  token: string;
  name?: string;
  userId?: string;
  actorType?: 'parent' | 'staff' | 'admin';
}

export interface SendPasswordResetEmailParams {
  to: string;
  token: string;
  name?: string;
  userId?: string;
  actorType?: 'parent' | 'staff' | 'admin';
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export type EmailTransportType = 'resend' | 'smtp';

/**
 * Returns active email transport provider.
 * Defaults to 'resend' for backward compatibility unless EMAIL_TRANSPORT is explicitly 'smtp'.
 */
export function getEmailTransport(): EmailTransportType {
  const envTransport = process.env.EMAIL_TRANSPORT?.trim().toLowerCase();
  if (envTransport === 'smtp') {
    return 'smtp';
  }
  return 'resend';
}

let customSmtpTransporter: Transporter | null = null;

/**
 * Test helper to inject a mock or custom Nodemailer transporter without performing network calls.
 * Pass null to reset to default transporter instantiation.
 */
export function _setSmtpTransporterForTesting(transporter: Transporter | null): void {
  customSmtpTransporter = transporter;
}

export function getSmtpTransporter(): Transporter {
  if (customSmtpTransporter) {
    return customSmtpTransporter;
  }

  const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT?.trim() || '465', 10);
  const secure = process.env.SMTP_SECURE?.trim() !== 'false';
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

function sanitizeError(errorMsg: string, token?: string): string {
  let sanitized = errorMsg;
  const smtpPass = process.env.SMTP_PASS?.trim();
  if (smtpPass) {
    sanitized = sanitized.replaceAll(smtpPass, '***');
  }
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    sanitized = sanitized.replaceAll(resendKey, '***');
  }
  if (token && token.trim()) {
    sanitized = sanitized.replaceAll(token.trim(), '***');
  }
  return sanitized;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  actorType?: 'parent' | 'staff' | 'admin';
  userId?: string;
  eventPrefix: 'welcome_email' | 'verification_email' | 'password_reset_email';
  tokenToSanitize?: string;
}

async function dispatchEmail(options: SendMailOptions): Promise<SendEmailResult> {
  const normalizedTo = options.to.trim().toLowerCase();

  // Automated test safeguard: never send real emails during automated test runs
  if (process.env.NODE_ENV === 'test' || process.env.RESEND_MOCK === 'true' || process.env.EMAIL_MOCK === 'true') {
    return {
      success: true,
      id: 'test_mock_email_id',
    };
  }

  const transport = getEmailTransport();

  if (transport === 'smtp') {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    // If no custom test transporter is set, require SMTP_USER and SMTP_PASS
    if (!customSmtpTransporter && (!user || !pass)) {
      logEvent({
        level: 'warn',
        event: `${options.eventPrefix}_skipped`,
        actorType: options.actorType || 'parent',
        actorId: options.userId,
        outcome: 'failure',
        details: { reason: 'SMTP_USER or SMTP_PASS is not configured in environment' },
      });
      return {
        success: false,
        error: 'SMTP_USER or SMTP_PASS is not configured in environment',
      };
    }

    const fromAddress =
      process.env.SMTP_FROM?.trim() ||
      (user ? `SchoolPass <${user}>` : 'SchoolPass <no-reply@schoolpass.ng>');

    try {
      const transporter = getSmtpTransporter();
      const info = await transporter.sendMail({
        from: fromAddress,
        to: [normalizedTo],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      logEvent({
        level: 'info',
        event: `${options.eventPrefix}_sent`,
        actorType: options.actorType || 'parent',
        actorId: options.userId,
        outcome: 'success',
        details: { messageId: info.messageId },
      });

      return {
        success: true,
        id: info.messageId,
      };
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : String(err);
      const sanitized = sanitizeError(rawError, options.tokenToSanitize);

      logEvent({
        level: 'error',
        event: `${options.eventPrefix}_error`,
        actorType: options.actorType || 'parent',
        actorId: options.userId,
        outcome: 'failure',
        details: { error: sanitized },
      });

      return {
        success: false,
        error: sanitized,
      };
    }
  }

  // Fallback / default: Resend REST API
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    logEvent({
      level: 'warn',
      event: `${options.eventPrefix}_skipped`,
      actorType: options.actorType || 'parent',
      actorId: options.userId,
      outcome: 'failure',
      details: { reason: 'RESEND_API_KEY is not configured in environment' },
    });
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured in environment',
    };
  }

  const fromAddress =
    process.env.RESEND_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    'SchoolPass <onboarding@resend.dev>';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [normalizedTo],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const rawMessage =
        data?.message || data?.error || `Resend API returned status ${response.status}`;
      const sanitized = sanitizeError(rawMessage, options.tokenToSanitize);

      logEvent({
        level: 'error',
        event: `${options.eventPrefix}_failed`,
        actorType: options.actorType || 'parent',
        actorId: options.userId,
        outcome: 'failure',
        details: { status: response.status, message: sanitized },
      });

      return {
        success: false,
        error: sanitized,
      };
    }

    logEvent({
      level: 'info',
      event: `${options.eventPrefix}_sent`,
      actorType: options.actorType || 'parent',
      actorId: options.userId,
      outcome: 'success',
      details: { messageId: data?.id },
    });

    return {
      success: true,
      id: data?.id,
    };
  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    const sanitized = sanitizeError(rawError, options.tokenToSanitize);

    logEvent({
      level: 'error',
      event: `${options.eventPrefix}_error`,
      actorType: options.actorType || 'parent',
      actorId: options.userId,
      outcome: 'failure',
      details: { error: sanitized },
    });

    return {
      success: false,
      error: sanitized,
    };
  }
}

/**
 * Returns canonical application base URL without trailing slash.
 * Defaults to https://schoolpass.ng.
 */
export function getAppBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'https://schoolpass.ng';
}

/**
 * Checks whether development testing stubs and helpers are active.
 * Strictly returns false in production, regardless of any environment flags.
 */
export function isDevStubsEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.NEXT_PUBLIC_ENABLE_DEV_STUBS === 'true';
}

// In-memory deduplication cache: type:email -> timestamp (valid for 5 minutes)
const recentSendsCache = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

function isRecentlySent(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  const lastSent = recentSendsCache.get(normalized);
  if (!lastSent) return false;
  if (Date.now() - lastSent > DEDUPE_WINDOW_MS) {
    recentSendsCache.delete(normalized);
    return false;
  }
  return true;
}

function markRecentlySent(key: string): void {
  const normalized = key.trim().toLowerCase();
  recentSendsCache.set(normalized, Date.now());
  // Prune expired entries if cache grows
  if (recentSendsCache.size > 1000) {
    const now = Date.now();
    for (const [k, timestamp] of recentSendsCache.entries()) {
      if (now - timestamp > DEDUPE_WINDOW_MS) {
        recentSendsCache.delete(k);
      }
    }
  }
}

/**
 * Builds responsive, email-client-compatible HTML for the SchoolPass welcome email.
 * Styled using SchoolPass design tokens: Primary (#087E8B), Surface (#FFFFFF), Neutral text (#334155).
 * Does not depend on external images or invented product features.
 */
export function buildWelcomeEmailHtml(name?: string): string {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to SchoolPass!</title>
  <style type="text/css">
    /* Base reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #f8fafc; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }

    /* Responsive adjustments */
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; border-radius: 6px !important; }
      .email-header { padding: 20px 20px !important; }
      .email-body { padding: 24px 20px !important; }
      .email-footer { padding: 16px 20px 24px 20px !important; }
      .email-headline { font-size: 20px !important; line-height: 1.3 !important; }
      .email-paragraph { font-size: 14px !important; line-height: 1.6 !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; color: #334155;">
  <!-- Outer Centering Table -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        <!-- Main Email Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Header Banner -->
          <tr>
            <td class="email-header" style="background-color: #087e8b; padding: 28px 32px; border-bottom: 3px solid #066a75;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <!-- Brand Pill Badge (Pure HTML/CSS, zero external image dependency) -->
                    <span style="display: inline-block; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; text-decoration: none;">
                      SchoolPass
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="email-body" style="padding: 36px 32px 28px 32px; background-color: #ffffff;">
              <h1 class="email-headline" style="margin: 0 0 20px 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Welcome to SchoolPass!
              </h1>

              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Welcome to SchoolPass! We're glad to have you here.
              </p>

              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                SchoolPass brings your school's essential information and services together in one place, making it easier to stay informed and connected.
              </p>

              <p class="email-paragraph" style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                We're excited to have you with us and look forward to making your school experience simpler.
              </p>

              <!-- Divider -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; height: 1px;"></td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p class="email-paragraph" style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Warm regards,<br>
                <strong style="color: #0f172a;">The SchoolPass Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This is an automated notification from SchoolPass. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain-text fallback for the SchoolPass welcome email.
 */
export function buildWelcomeEmailText(name?: string): string {
  return `Welcome to SchoolPass!

Welcome to SchoolPass! We're glad to have you here.

SchoolPass brings your school's essential information and services together in one place, making it easier to stay informed and connected.

We're excited to have you with us and look forward to making your school experience simpler.

Warm regards,
The SchoolPass Team

---
This is an automated notification from SchoolPass.`;
}

/**
 * Sends the welcome email using active transport (Resend or Gmail SMTP).
 * Returns a result object without throwing.
 */
export async function sendWelcomeEmail(params: SendWelcomeEmailParams): Promise<SendEmailResult> {
  const normalizedTo = params.to.trim().toLowerCase();

  const dedupeKey = `welcome:${normalizedTo}`;
  // Deduplication check
  if (isRecentlySent(dedupeKey)) {
    return {
      success: true,
      error: 'Deduplicated: welcome email was recently sent to this address',
    };
  }

  const htmlContent = buildWelcomeEmailHtml(params.name);
  const textContent = buildWelcomeEmailText(params.name);

  const result = await dispatchEmail({
    to: normalizedTo,
    subject: 'Welcome to SchoolPass!',
    html: htmlContent,
    text: textContent,
    actorType: params.actorType,
    userId: params.userId,
    eventPrefix: 'welcome_email',
  });

  if (result.success && result.id) {
    markRecentlySent(dedupeKey);
  }

  return result;
}

/**
 * Dispatches welcome email in the background without delaying user registration.
 * Uses Next.js 15 `after()` to ensure the serverless runtime lifecycle remains
 * active until delivery finishes, while isolating registration from email errors.
 */
export function triggerWelcomeEmail(params: SendWelcomeEmailParams): void {
  try {
    if (typeof after === 'function') {
      after(async () => {
        try {
          await sendWelcomeEmail(params);
        } catch {
          // Failure handled inside sendWelcomeEmail
        }
      });
      return;
    }
  } catch {
    // If after() was invoked outside of request context, fallback to safe detached promise
  }

  // Fallback for non-request environments
  sendWelcomeEmail(params).catch(() => {
    // Failure handled inside sendWelcomeEmail
  });
}

/**
 * Builds responsive HTML email for parent email verification.
 */
export function buildVerificationEmailHtml(token: string, name?: string): string {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const baseUrl = getAppBaseUrl();
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Confirm Your SchoolPass Email</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #f8fafc; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; border-radius: 6px !important; }
      .email-header { padding: 20px 20px !important; }
      .email-body { padding: 24px 20px !important; }
      .email-footer { padding: 16px 20px 24px 20px !important; }
      .email-headline { font-size: 20px !important; line-height: 1.3 !important; }
      .email-paragraph { font-size: 14px !important; line-height: 1.6 !important; }
      .email-button { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; color: #334155;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Header Banner -->
          <tr>
            <td class="email-header" style="background-color: #087e8b; padding: 28px 32px; border-bottom: 3px solid #066a75;">
              <span style="display: inline-block; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; text-decoration: none;">
                SchoolPass
              </span>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="email-body" style="padding: 36px 32px 28px 32px; background-color: #ffffff;">
              <h1 class="email-headline" style="margin: 0 0 20px 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Confirm Your Email Address
              </h1>

              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                ${greeting}
              </p>

              <p class="email-paragraph" style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Thank you for registering on SchoolPass. To complete your registration and activate access to your child's records, please confirm your email address by clicking the button below:
              </p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #087e8b;">
                    <a href="${verificationUrl}" target="_blank" class="email-button" style="display: inline-block; padding: 14px 28px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #087e8b;">
                      Verify Email Address &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #087e8b; word-break: break-all; text-decoration: underline;">
                  ${verificationUrl}
                </a>
              </p>

              <!-- Expiry Note -->
              <p class="email-paragraph" style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; line-height: 1.6; color: #64748b;">
                <strong>Security note:</strong> This verification link will expire in 24 hours. If you did not sign up for SchoolPass, please disregard this email.
              </p>

              <!-- Divider -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; height: 1px;"></td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p class="email-paragraph" style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Warm regards,<br>
                <strong style="color: #0f172a;">The SchoolPass Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This is an automated notification from SchoolPass. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain-text fallback for email verification.
 */
export function buildVerificationEmailText(token: string, name?: string): string {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const baseUrl = getAppBaseUrl();
  const verificationUrl = `${baseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`;

  return `Confirm Your SchoolPass Email

${greeting}

Thank you for registering on SchoolPass. To complete your registration and activate access to your child's records, please confirm your email address by visiting the link below:

${verificationUrl}

Security note: This verification link will expire in 24 hours. If you did not sign up for SchoolPass, please disregard this email.

Warm regards,
The SchoolPass Team

---
This is an automated notification from SchoolPass.`;
}

/**
 * Sends parent email verification link using active transport (Resend or Gmail SMTP).
 */
export async function sendVerificationEmail(params: SendVerificationEmailParams): Promise<SendEmailResult> {
  const normalizedTo = params.to.trim().toLowerCase();
  const htmlContent = buildVerificationEmailHtml(params.token, params.name);
  const textContent = buildVerificationEmailText(params.token, params.name);

  return dispatchEmail({
    to: normalizedTo,
    subject: 'Confirm your SchoolPass email address',
    html: htmlContent,
    text: textContent,
    actorType: params.actorType,
    userId: params.userId,
    eventPrefix: 'verification_email',
    tokenToSanitize: params.token,
  });
}

/**
 * Dispatches verification email in the background without delaying the HTTP response.
 */
export function triggerVerificationEmail(params: SendVerificationEmailParams): void {
  try {
    if (typeof after === 'function') {
      after(async () => {
        try {
          await sendVerificationEmail(params);
        } catch {
          // Failure handled inside sendVerificationEmail
        }
      });
      return;
    }
  } catch {
    // If after() was invoked outside of request context, fallback to safe detached promise
  }

  sendVerificationEmail(params).catch(() => {
    // Failure handled inside sendVerificationEmail
  });
}

/**
 * Builds responsive HTML email for password reset.
 */
export function buildPasswordResetEmailHtml(token: string, name?: string): string {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Reset Your SchoolPass Password</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100%; background-color: #f8fafc; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .email-card { width: 100% !important; border-radius: 6px !important; }
      .email-header { padding: 20px 20px !important; }
      .email-body { padding: 24px 20px !important; }
      .email-footer { padding: 16px 20px 24px 20px !important; }
      .email-headline { font-size: 20px !important; line-height: 1.3 !important; }
      .email-paragraph { font-size: 14px !important; line-height: 1.6 !important; }
      .email-button { display: block !important; width: 100% !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; color: #334155;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 580px; width: 100%; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); text-align: left;">
          
          <!-- Header Banner -->
          <tr>
            <td class="email-header" style="background-color: #087e8b; padding: 28px 32px; border-bottom: 3px solid #066a75;">
              <span style="display: inline-block; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; text-decoration: none;">
                SchoolPass
              </span>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="email-body" style="padding: 36px 32px 28px 32px; background-color: #ffffff;">
              <h1 class="email-headline" style="margin: 0 0 20px 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 22px; font-weight: 700; color: #0f172a; line-height: 1.3;">
                Reset Your Password
              </h1>

              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                ${greeting}
              </p>

              <p class="email-paragraph" style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                We received a request to reset the password for your SchoolPass account. Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 28px 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 6px; background-color: #087e8b;">
                    <a href="${resetUrl}" target="_blank" class="email-button" style="display: inline-block; padding: 14px 28px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #087e8b;">
                      Reset Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Link -->
              <p class="email-paragraph" style="margin: 0 0 16px 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #087e8b; word-break: break-all; text-decoration: underline;">
                  ${resetUrl}
                </a>
              </p>

              <!-- Expiry & Ignore Notice -->
              <p class="email-paragraph" style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; line-height: 1.6; color: #64748b;">
                <strong>Security note:</strong> This password reset link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email; your account remains secure and no changes have been made.
              </p>

              <!-- Divider -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
                <tr>
                  <td style="border-top: 1px solid #e2e8f0; height: 1px;"></td>
                </tr>
              </table>

              <!-- Sign-off -->
              <p class="email-paragraph" style="margin: 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Warm regards,<br>
                <strong style="color: #0f172a;">The SchoolPass Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer" style="padding: 20px 32px 28px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                This is an automated notification from SchoolPass. Please do not reply directly to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds plain-text fallback for password reset.
 */
export function buildPasswordResetEmailText(token: string, name?: string): string {
  const greeting = name && name.trim() ? `Hello ${name.trim()},` : 'Hello,';
  const baseUrl = getAppBaseUrl();
  const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

  return `Reset Your SchoolPass Password

${greeting}

We received a request to reset the password for your SchoolPass account. Please visit the link below to choose a new password:

${resetUrl}

Security note: This password reset link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email; your account remains secure and no changes have been made.

Warm regards,
The SchoolPass Team

---
This is an automated notification from SchoolPass.`;
}

/**
 * Sends password reset email using active transport (Resend or Gmail SMTP).
 */
export async function sendPasswordResetEmail(params: SendPasswordResetEmailParams): Promise<SendEmailResult> {
  const normalizedTo = params.to.trim().toLowerCase();
  const htmlContent = buildPasswordResetEmailHtml(params.token, params.name);
  const textContent = buildPasswordResetEmailText(params.token, params.name);

  return dispatchEmail({
    to: normalizedTo,
    subject: 'Reset your SchoolPass password',
    html: htmlContent,
    text: textContent,
    actorType: params.actorType,
    userId: params.userId,
    eventPrefix: 'password_reset_email',
    tokenToSanitize: params.token,
  });
}

/**
 * Dispatches password reset email in the background without delaying the HTTP response.
 */
export function triggerPasswordResetEmail(params: SendPasswordResetEmailParams): void {
  try {
    if (typeof after === 'function') {
      after(async () => {
        try {
          await sendPasswordResetEmail(params);
        } catch {
          // Failure handled inside sendPasswordResetEmail
        }
      });
      return;
    }
  } catch {
    // If after() was invoked outside of request context, fallback to safe detached promise
  }

  sendPasswordResetEmail(params).catch(() => {
    // Failure handled inside sendPasswordResetEmail
  });
}
