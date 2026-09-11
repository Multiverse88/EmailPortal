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
  replyTo?: string;
  inReplyTo?: string;
  references?: string;
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
      replyTo: opts.replyTo,
      inReplyTo: opts.inReplyTo,
      references: opts.references,
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
export async function sendOnboardingNotice(
  personalEmail: string,
  mailboxAddress: string,
  tempPassword?: string,
  customerName?: string
) {
  if (!smtpConfigured()) {
    console.log(`[onboarding] would notify ${personalEmail} about ${mailboxAddress} (SMTP not configured: HOSTINGER_SMTP_PASS is missing or default)`);
    return { delivered: false };
  }

  const portalUrl = (process.env.CORS_ORIGIN || 'https://clienteasylegal.co.id').split(',')[0].trim();
  const nameDisplay = customerName || 'Klien EasyLegal';

  const textBody = tempPassword
    ? `Halo ${nameDisplay},\n\nAkun email korporasi resmi Anda di EasyLegal Portal telah aktif.\n\nAlamat Email Portal: ${mailboxAddress}\nPassword Sementara: ${tempPassword}\n\nSilakan masuk di: ${portalUrl}/login\nDemi keamanan akun, harap segera perbarui kata sandi Anda di menu Pengaturan Keamanan setelah berhasil masuk.\n\nSalam,\nTim EasyLegal`
    : `Halo ${nameDisplay},\n\nAkun email korporasi resmi Anda di EasyLegal Portal telah aktif.\n\nAlamat Email Portal: ${mailboxAddress}\n\nSilakan masuk di: ${portalUrl}/login\nPassword sementara dikirimkan oleh admin melalui jalur komunikasi resmi terpisah.\n\nSalam,\nTim EasyLegal`;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${portalUrl}/companion/el/el-avatar-kepala.png" width="56" height="56" alt="EasyLegal Portal" style="width: 56px; height: 56px; border-radius: 12px; margin-bottom: 12px; display: inline-block; object-fit: contain; border: 1px solid #e2e8f0;" />
        <h1 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0;">EasyLegal Customer Portal</h1>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Aktivasi Akun & Akses Mailbox Resmi</p>
      </div>

      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
        Halo <strong>${nameDisplay}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
        Selamat! Akun portal surat-menyurat resmi dan legal drive korporasi Anda telah berhasil dibuat dan siap digunakan.
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; width: 140px;">Alamat Email:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${mailboxAddress}</td>
          </tr>
          ${
            tempPassword
              ? `<tr>
            <td style="padding: 6px 0; color: #64748b;">Password Sementara:</td>
            <td style="padding: 6px 0; font-weight: 700; font-family: monospace; font-size: 14px; color: #0284c7;">${tempPassword}</td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding: 6px 0; color: #64748b;">Kapasitas Penyimpanan:</td>
            <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">5.0 GB Cloud Drive & Email Storage</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 26px 0;">
        <a href="${portalUrl}/login" style="background-color: #0284c7; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Masuk ke Portal Customer</a>
      </div>

      ${
        tempPassword
          ? `<div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
        <p style="margin: 0; color: #1e40af; font-size: 12px; line-height: 1.5;">
          <strong>Tips Keamanan:</strong> Demi menjaga kerahasiaan korespondensi hukum dan dokumen perusahaan Anda, segera perbarui kata sandi Anda di menu <strong>Pengaturan &gt; Keamanan</strong> setelah berhasil masuk.
        </p>
      </div>`
          : ''
      }

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
        Pemberitahuan otomatis dari sistem EasyLegal Customer Portal. Jangan bagikan kata sandi Anda kepada siapa pun.
      </p>
    </div>
  `;

  try {
    return await sendMail({
      user: process.env.HOSTINGER_SMTP_USER!,
      pass: process.env.HOSTINGER_SMTP_PASS!,
      name: 'EasyLegal Portal',
      to: personalEmail,
      subject: `Selamat Datang di EasyLegal Portal - Akun ${mailboxAddress} Sudah Aktif`,
      text: textBody,
      html: htmlBody,
    });
  } catch (err: any) {
    console.warn(`[onboarding] failed to notify ${personalEmail}:`, err.message);
    return { delivered: false };
  }
}
