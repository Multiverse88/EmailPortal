import { PrismaClient } from '@prisma/client';
import { sendMail } from './mail';

export interface ClientInfo {
  ipAddress: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  location: string;
}

export interface SecurityAlertResult {
  isNewDevice: boolean;
  sent: boolean;
}

export async function checkAndSendNewDeviceAlert(
  prisma: PrismaClient,
  customer: { id: string; name: string; mailboxAddress: string; personalEmail: string },
  clientInfo: ClientInfo
): Promise<SecurityAlertResult> {
  try {
    const pastSessions = await prisma.loginSession.findMany({
      where: { customerId: customer.id },
      select: { ipAddress: true, deviceName: true },
    });

    if (pastSessions.length === 0) {
      return { isNewDevice: false, sent: false };
    }

    const isKnown = pastSessions.some(
      (s) => s.ipAddress === clientInfo.ipAddress || s.deviceName === clientInfo.deviceName
    );

    if (isKnown) {
      return { isNewDevice: false, sent: false };
    }

    // New device/IP detected - send alert to customer's personal email
    const timestampStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const portalUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';

    const textBody = [
      `Halo ${customer.name},`,
      '',
      `Sistem keamanan EasyLegal mendeteksi aktivitas login baru pada akun Anda:`,
      `• Alamat Mailbox: ${customer.mailboxAddress}`,
      `• Perangkat: ${clientInfo.deviceName}`,
      `• Alamat IP: ${clientInfo.ipAddress}`,
      `• Perkiraan Lokasi: ${clientInfo.location}`,
      `• Waktu (WIB): ${timestampStr}`,
      '',
      `Jika ini adalah Anda, Anda dapat mengabaikan pemberitahuan ini dengan aman.`,
      `Jika Anda TIDAK mengenali aktivitas ini, akun Anda mungkin dalam bahaya. Segera lakukan langkah berikut:`,
      `1. Masuk ke portal EasyLegal di ${portalUrl}/settings`,
      `2. Pada tab Keamanan, klik "Putuskan Semua Sesi Lain"`,
      `3. Ubah kata sandi akun Anda segera dan aktifkan Autentikasi 2 Faktor (2FA).`,
      '',
      `Salam hangat,`,
      `EasyLegal Security Sentinel`,
    ].join('\n');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #b91c1c; margin: 0 0 8px 0; font-size: 20px;">⚠️ Peringatan Keamanan Akun</h2>
          <p style="color: #64748b; font-size: 14px; margin: 0;">Aktivitas login baru terdeteksi di portal EasyLegal</p>
        </div>

        <p>Halo <strong>${customer.name}</strong>,</p>
        <p>Sistem mendeteksi adanya sesi login dari perangkat atau lokasi baru pada akun <strong>${customer.mailboxAddress}</strong>:</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #64748b; width: 140px;">Perangkat</td><td style="padding: 6px 0; font-weight: 600;">${clientInfo.deviceName}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Alamat IP</td><td style="padding: 6px 0; font-weight: 600;">${clientInfo.ipAddress}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Lokasi</td><td style="padding: 6px 0; font-weight: 600;">${clientInfo.location}</td></tr>
            <tr><td style="padding: 6px 0; color: #64748b;">Waktu Deteksi</td><td style="padding: 6px 0; font-weight: 600;">${timestampStr} WIB</td></tr>
          </table>
        </div>

        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 13px;">
            <strong>Bukan Anda?</strong> Segera amankan akun Anda dengan memutuskan seluruh sesi aktif lainnya di menu Pengaturan Keamanan dan memperbarui kata sandi Anda.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}/settings" style="background-color: #0f172a; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; display: inline-block;">Periksa Keamanan Akun</a>
        </div>

        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Pemberitahuan otomatis dari sistem perlindungan akun EasyLegal Customer Portal.
        </p>
      </div>
    `;

    await sendMail({
      user: process.env.HOSTINGER_SMTP_USER || 'security@clienteasylegal.co.id',
      pass: process.env.HOSTINGER_SMTP_PASS || 'mock-pass',
      name: 'EasyLegal Security Sentinel',
      to: customer.personalEmail,
      subject: `⚠️ Peringatan Keamanan: Login Baru Terdeteksi (${customer.mailboxAddress})`,
      text: textBody,
      html: htmlBody,
    });

    return { isNewDevice: true, sent: true };
  } catch (error) {
    console.error('Error checking new device alert:', error);
    return { isNewDevice: true, sent: false };
  }
}
