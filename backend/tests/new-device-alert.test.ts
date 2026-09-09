import { prisma } from '../src/app';
import { checkAndSendNewDeviceAlert } from '../src/lib/security-alerts';
import { encrypt } from '../src/lib/crypto';

describe('New Device / IP Login Alert Sentinel', () => {
  let customer: any;

  beforeAll(async () => {
    const timestamp = Date.now();
    customer = await prisma.customer.create({
      data: {
        name: 'Device Alert Customer',
        personalEmail: `device-alert-${timestamp}@example.com`,
        mailboxAddress: `device-alert-${timestamp}@clienteasylegal.co.id`,
        passwordEnc: encrypt('SamplePass123!'),
        status: 'active',
      },
    });

    // Seed known session (IP: 103.20.10.1, Chrome on macOS)
    await prisma.loginSession.create({
      data: {
        customerId: customer.id,
        deviceName: 'Chrome on macOS',
        deviceType: 'laptop',
        browser: 'Chrome',
        ipAddress: '103.20.10.1',
        location: 'Jakarta, Indonesia',
        isCurrent: true,
      },
    });
  });

  afterAll(async () => {
    if (customer?.id) {
      await prisma.loginSession.deleteMany({ where: { customerId: customer.id } });
      await prisma.customer.delete({ where: { id: customer.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('does NOT trigger alert if login comes from known IP and device', async () => {
    const clientInfo = {
      ipAddress: '103.20.10.1',
      deviceName: 'Chrome on macOS',
      deviceType: 'laptop',
      browser: 'Chrome',
      location: 'Jakarta, Indonesia',
    };
    const result = await checkAndSendNewDeviceAlert(prisma, customer, clientInfo);
    expect(result.isNewDevice).toBe(false);
    expect(result.sent).toBe(false);
  });

  it('triggers alert email to personalEmail when login comes from an unrecognized IP and device', async () => {
    const unfamiliarClient = {
      ipAddress: '180.252.99.88',
      deviceName: 'Safari on iPhone',
      deviceType: 'mobile',
      browser: 'Safari',
      location: 'Surabaya, Indonesia',
    };
    const result = await checkAndSendNewDeviceAlert(prisma, customer, unfamiliarClient);
    expect(result.isNewDevice).toBe(true);
    expect(result.sent).toBe(true);
  });
});
