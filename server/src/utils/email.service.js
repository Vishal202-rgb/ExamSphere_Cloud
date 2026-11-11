// ==============================================================================
// ExamSphere – Enterprise Email Dispatcher Service (Nodemailer)
// Supports Real SMTP delivery and secure development transport logging
// ==============================================================================

import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.isRealSmtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

    if (this.isRealSmtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_SECURE || false,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
      console.log('📧 [EmailService] SMTP transporter initialized for host:', env.SMTP_HOST);
    } else {
      // Safe development/test fallback transport
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'windows',
        buffer: true,
      });
      if (env.NODE_ENV !== 'test') {
        console.log('📧 [EmailService] Using secure local development email transport (SMTP not configured)');
      }
    }
  }

  /**
   * Helper to send email with safe logging
   */
  async sendMail({ to, subject, html, text }) {
    try {
      const mailOptions = {
        from: env.SMTP_FROM || 'ExamSphere <noreply@examsphere.io>',
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (!this.isRealSmtpConfigured && env.NODE_ENV !== 'test') {
        // Safe logger: Never expose raw passwords or raw tokens in system logs
        console.log(`📨 [Email Delivered (Dev Mode)] To: ${to} | Subject: "${subject}" | MessageId: ${info.messageId || 'DEV-LOG'}`);
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ [EmailService] Failed to send email to ${to}:`, error.message);
      // In development, do not crash the request flow if SMTP fails
      if (env.NODE_ENV === 'production') {
        throw error;
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Send single-use account invitation email
   */
  async sendInvitationEmail({ to, name, role, inviteUrl, expiresAt }) {
    const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const roleLabel =
      role === 'SUPER_ADMIN'
        ? 'Super Administrator'
        : role === 'DEPARTMENT_ADMIN'
        ? 'Department Administrator'
        : role === 'FACULTY'
        ? 'Faculty Member'
        : 'Student';

    const subject = `ExamSphere – Invitation to join as ${roleLabel}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #38bdf8; margin: 0; font-size: 24px; font-weight: 700;">ExamSphere</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Online Examination & Assessment Platform</p>
        </div>
        <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="color: #f8fafc; font-size: 18px; margin-top: 0;">Welcome, ${name || 'Colleague'}!</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            You have been officially invited to join <strong>ExamSphere</strong> as a <strong>${roleLabel}</strong>.
          </p>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Please click the button below to accept your invitation, verify your institutional email, and securely set your password.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
              Activate Account & Set Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
            This single-use link will expire on <strong>${formattedExpiry}</strong>. If you did not request this account, please notify your institution's system administrator.
          </p>
        </div>
        <div style="text-align: center; font-size: 11px; color: #64748b;">
          &copy; ${new Date().getFullYear()} ExamSphere Enterprise. All rights reserved.
        </div>
      </div>
    `;

    const text = `Welcome to ExamSphere!\n\nYou have been invited to join as ${roleLabel}.\nActivate your account and set your password here:\n${inviteUrl}\n\nThis single-use link expires on ${formattedExpiry}.`;

    return this.sendMail({ to, subject, html, text });
  }

  /**
   * Send account activation link for direct admin-created accounts
   */
  async sendActivationEmail({ to, name, role, activationUrl, expiresAt }) {
    const formattedExpiry = new Date(expiresAt).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const subject = 'ExamSphere – Set Up Your Institutional Password';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #38bdf8; margin: 0; font-size: 24px; font-weight: 700;">ExamSphere</h1>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">Institutional Account Activation</p>
        </div>
        <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="color: #f8fafc; font-size: 18px; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Your ExamSphere account has been provisioned by an authorized institutional administrator.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${activationUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">
              Set Your Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin-bottom: 0;">
            This link is valid until <strong>${formattedExpiry}</strong>. Plaintext passwords are never transmitted via email.
          </p>
        </div>
      </div>
    `;

    const text = `Hello ${name},\n\nYour ExamSphere account has been provisioned.\nSet your secure password here:\n${activationUrl}\n\nLink expires: ${formattedExpiry}.`;

    return this.sendMail({ to, subject, html, text });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail({ to, name, resetUrl, expiresAt }) {
    const subject = 'ExamSphere – Password Reset Request';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
        <h2 style="color: #38bdf8;">Password Reset Request</h2>
        <p style="color: #cbd5e1; font-size: 14px;">We received a request to reset your password. Click below to proceed:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px;">Reset Password</a>
        </div>
        <p style="color: #94a3b8; font-size: 12px;">If you did not request this, you can safely ignore this email.</p>
      </div>
    `;

    const text = `Password Reset Request\n\nReset your password here:\n${resetUrl}\n\nIf you did not request this, ignore this email.`;

    return this.sendMail({ to, subject, html, text });
  }
}

export const emailService = new EmailService();
