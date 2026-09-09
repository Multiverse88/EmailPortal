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
  name?: string;
  to: string;
  cc?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; path: string }[];
}) {
  if (process.env.NODE_ENV === 'test') {
    return { delivered: true };
  }

  if (!opts.user || !opts.pass) {
    throw new Error('Kredensial email pengirim tidak lengkap');
  }

  const host = process.env.HOSTINGER_SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.HOSTINGER_SMTP_PORT || '465');
  const secure = port === 465;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: opts.user, pass: opts.pass },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const from = opts.name ? `"${opts.name}" <${opts.user}>` : opts.user;

  try {
    const info = await transport.sendMail({
      from,
      to: opts.to,
      cc: opts.cc,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`SMTP send failed for ${opts.user}:`, error.message);
    if (error.responseCode === 535 || error.code === 'EAUTH') {
      throw new Error(
        `Autentikasi SMTP gagal untuk ${opts.user}. Pastikan mailbox ini sudah aktif di Hostinger atau login dengan akun mailbox nyata.`
      );
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
  try {
    return await sendMail({
      user: process.env.HOSTINGER_SMTP_USER!,
      pass: process.env.HOSTINGER_SMTP_PASS!,
      to: personalEmail,
      subject: `Akun email ${mailboxAddress} sudah aktif`,
      text: `Mailbox ${mailboxAddress} sudah dibuat. Login di ${process.env.CORS_ORIGIN}/login. Password sementara dikirim admin lewat kanal terpisah.`,
    });
  } catch (err: any) {
    console.warn(`[onboarding] failed to notify ${personalEmail}:`, err.message);
    return { delivered: false };
  }
}
