import { Injectable } from '@nestjs/common';
import { getRuntimeConfig } from '#config';

@Injectable()
export class EmailDeliveryService {
  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.deliver(
      email,
      'Verify your email address',
      `Your verification code is ${code}. It expires in 10 minutes.`,
      `<p>Your verification code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 10 minutes.</p>`,
    );
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    await this.deliver(
      email,
      'Reset your password',
      `Use this link to reset your password. It expires in 30 minutes.\n\n${resetUrl}`,
      `<p>Use this link to reset your password. It expires in 30 minutes.</p><p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
    );
  }

  async sendEmailChangeConfirmation(email: string, confirmationUrl: string): Promise<void> {
    await this.deliver(
      email,
      'Confirm your email address',
      `Confirm this email address within 30 minutes.\n\n${confirmationUrl}`,
      `<p>Confirm this email address within 30 minutes.</p><p><a href="${escapeHtml(confirmationUrl)}">Confirm email</a></p>`,
    );
  }

  async sendEmailChangeNotice(email: string, newEmail: string): Promise<void> {
    await this.deliver(
      email,
      'Your account email changed',
      `Your account email changed to ${newEmail}. Contact support if you did not make this change.`,
      `<p>Your account email changed to <strong>${escapeHtml(newEmail)}</strong>.</p><p>Contact support if you did not make this change.</p>`,
    );
  }

  private async deliver(email: string, subject: string, text: string, html: string): Promise<void> {
    const { resendApiKey: apiKey, resendFromEmail: from } = getRuntimeConfig();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error('Email provider rejected the message');
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}
