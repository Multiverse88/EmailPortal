import nodemailer from 'nodemailer';

export const smtpConfigured = () =>
  Boolean(
    process.env.HOSTINGER_SMTP_HOST &&
    process.env.HOSTINGER_SMTP_PASS &&
    !process.env.HOSTINGER_SMTP_PASS.includes('your_') &&
    process.env.HOSTINGER_SMTP_PASS !== 'your_smtp_password_here' &&
    process.env.NODE_ENV !== 'test'
  );

export async function sendMail(opts: {
  user: string;
  pass: string;
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; path: string }[];
}) {
  // ponytail: no SMTP creds in dev -> caller still writes the message to the
  // Sent folder, so the UI path is identical once creds exist.
  if (!smtpConfigured()) return { delivered: false, reason: 'SMTP not configured' };

  const transport = nodemailer.createTransport({
    host: process.env.HOSTINGER_SMTP_HOST,
    port: parseInt(process.env.HOSTINGER_SMTP_PORT || '465'),
    secure: parseInt(process.env.HOSTINGER_SMTP_PORT || '465') === 465,
    auth: { user: opts.user, pass: opts.pass },
  });

  try {
    await transport.sendMail({
      from: opts.user,
      to: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { delivered: true };
  } catch (error) {
    console.error('SMTP send failed:', (error as Error).message);
    if (process.env.NODE_ENV === 'development') {
      return { delivered: false, reason: (error as Error).message };
    }
    throw error;
  }
}

// FR-18: onboarding notice goes to the customer's *personal* address.
export async function sendOnboardingNotice(personalEmail: string, mailboxAddress: string) {
  if (!smtpConfigured()) {
    console.log(`[onboarding] would notify ${personalEmail} about ${mailboxAddress}`);
    return { delivered: false };
  }
  return sendMail({
    user: process.env.HOSTINGER_SMTP_USER!,
    pass: process.env.HOSTINGER_SMTP_PASS!,
    to: personalEmail,
    subject: `Akun email ${mailboxAddress} sudah aktif`,
    text: `Mailbox ${mailboxAddress} sudah dibuat. Login di ${process.env.CORS_ORIGIN}/login. Password sementara dikirim admin lewat kanal terpisah.`,
  });
}
