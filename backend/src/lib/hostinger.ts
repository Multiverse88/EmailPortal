/**
 * Hostinger Mail API SDK wrapper.
 *
 * Mail operations (read/send/quota) flow through this SDK.
 * Mailbox provisioning (create) is done via the Hostinger Panel API and is
 * OUT OF SCOPE of this SDK; see auth.ts register for the stub.
 *
 * ponytail: When Hostinger adds a create-mailbox endpoint to the Mail API SDK,
 * replace the Panel-API call in auth.ts register route.
 */
import {
  Configuration,
  AccountApi,
  MessagesApi,
  SendApi,
  QuotaApi,
} from 'hostinger-mail-api-sdk';
import axios from 'axios';

// ─── hPanel API (provisioning) ────────────────────────────────────────────
// The Mail API SDK only manages existing mailboxes. Creating / deleting
// mailboxes requires the separate hPanel REST API at api.hostinger.com.
// ponytail: when Hostinger adds createMailbox to the Mail API SDK, replace
// this direct HTTP call with the SDK method.

export function getApiToken(): string | undefined {
  return process.env.HOSTINGER_API_TOKEN || process.env.HOSTINGER_MAIL_API_KEY;
}

export function getBaseUrl(): string {
  return process.env.HOSTINGER_API_BASE_URL || 'https://api.hostinger.com';
}

/**
 * Create a mailbox on Hostinger via hPanel API.
 * Returns the created mailbox info or throws.
 */
export async function createMailboxOnHostinger(orderId: string, localPart: string, password: string): Promise<{
  id: string;
  address: string;
  status: string;
}> {
  const token = getApiToken();
  if (!token) throw new Error('HOSTINGER_API_TOKEN or HOSTINGER_MAIL_API_KEY not set');

  const domain = process.env.HOSTINGER_DOMAIN || 'clienteasylegal.co.id';
  const res = await axios.post(
    `${getBaseUrl()}/api/mail/v1/orders/${orderId}/mailboxes`,
    { local_part: localPart, password },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );

  const mailbox = res.data?.data ?? res.data;
  return {
    id: mailbox?.id || mailbox?.resourceId || mailbox?.mailbox_id || '',
    address: mailbox?.address || `${localPart}@${domain}`,
    status: mailbox?.status ?? 'active',
  };
}

/**
 * Delete a mailbox on Hostinger via hPanel API.
 */
export async function deleteMailboxOnHostinger(mailboxId: string): Promise<void> {
  const token = getApiToken();
  if (!token) throw new Error('HOSTINGER_API_TOKEN not set');
  await axios.delete(`${getBaseUrl()}/api/mail/v1/mailboxes/${mailboxId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 30000,
  });
}

/**
 * Change a mailbox password on Hostinger via hPanel API.
 */
export async function changeMailboxPasswordOnHostinger(mailboxId: string, newPassword: string): Promise<void> {
  const token = getApiToken();
  if (!token) throw new Error('HOSTINGER_API_TOKEN not set');
  await axios.patch(
    `${getBaseUrl()}/api/mail/v1/mailboxes/${mailboxId}/password`,
    { password: newPassword },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );
}

let _config: Configuration | null = null;
let _accountApi: AccountApi | null = null;
let _messagesApi: MessagesApi | null = null;
let _sendApi: SendApi | null = null;
let _quotaApi: QuotaApi | null = null;

function config(): Configuration {
  if (!_config) {
    const token = getApiToken();
    if (!token) throw new Error('HOSTINGER_API_TOKEN or HOSTINGER_MAIL_API_KEY not set');
    _config = new Configuration({ accessToken: token });
  }
  return _config;
}

export function isMailApiConfigured(): boolean {
  return !!getApiToken();
}

export function isProvisioningConfigured(): boolean {
  return !!getApiToken();
}

export function accountApi(): AccountApi {
  if (!_accountApi) _accountApi = new AccountApi(config());
  return _accountApi;
}

export function messagesApi(): MessagesApi {
  if (!_messagesApi) _messagesApi = new MessagesApi(config());
  return _messagesApi;
}

export function sendApi(): SendApi {
  if (!_sendApi) _sendApi = new SendApi(config());
  return _sendApi;
}

export function quotaApi(): QuotaApi {
  if (!_quotaApi) _quotaApi = new QuotaApi(config());
  return _quotaApi;
}

/**
 * Resolve resourceId for a mailbox address by calling GET /v1/me.
 * Returns undefined if the mailbox is not found under the current API token.
 */
export async function resolveResourceId(address: string): Promise<string | undefined> {
  const me = await accountApi().getCurrentAccount();
  const mailboxes: Array<{ resourceId: string; address: string }> =
    (me.data as any).data?.mailboxes ?? [];
  return mailboxes.find((m) => m.address.toLowerCase() === address.toLowerCase())?.resourceId;
}

/**
 * Resolve orderId from the Mail API account info. Returns undefined when no
 * token is configured or no order is attached to the token.
 */
export async function resolveOrderResourceId(): Promise<string | undefined> {
  try {
    const me = await accountApi().getCurrentAccount();
    return (me.data as any).data?.orderResourceId;
  } catch {
    return undefined;
  }
}

export async function listManagedMailboxes(): Promise<Array<{ resourceId: string; address: string }>> {
  const me = await accountApi().getCurrentAccount();
  return (me.data as any).data?.mailboxes ?? [];
}

/**
 * Fetch message list from the Hostinger Mail API.
 * Returns an array of simplified message metadata objects.
 */
export async function fetchMessages(
  resourceId: string,
  folder: string,
  opts?: { page?: number; perPage?: number; sort?: string },
): Promise<Array<{
  uid: number;
  subject: string;
  sender: string;
  date: string;
  unseen: boolean;
  flags: string[];
}>> {
  const res = await messagesApi().listMessages(resourceId, folder, opts?.page, opts?.perPage, opts?.sort);
  const messages = ((res.data as any).data ?? []) as Array<{
    uid: number;
    subject: string;
    from?: { name: string; address: string };
    date: string;
    unseen: boolean;
    flags: string[];
  }>;
  return messages.map(m => ({
    uid: m.uid,
    subject: m.subject ?? '(tanpa subjek)',
    sender: m.from?.address ?? m.from?.name ?? 'unknown',
    date: m.date ?? '',
    unseen: m.unseen ?? false,
    flags: m.flags ?? [],
  }));
}

/**
 * Get rendered plain-text + HTML body for a message. Marks it as seen.
 */
export async function fetchMessageBody(
  resourceId: string,
  folder: string,
  uid: number,
): Promise<{ text: string; html: string } | null> {
  try {
    const res = await messagesApi().getMessageText(resourceId, folder, uid);
    return (res.data as any).data ?? null;
  } catch (e) {
    console.warn(`fetchMessageBody failed for uid=${uid}:`, (e as Error).message);
    return null;
  }
}

/**
 * Get full message metadata (from, to, attachments, etc.) without body.
 */
export async function fetchMessageMeta(
  resourceId: string,
  folder: string,
  uid: number,
): Promise<any | null> {
  try {
    const res = await messagesApi().getMessage(resourceId, folder, uid);
    return (res.data as any).data ?? null;
  } catch (e) {
    console.warn(`fetchMessageMeta failed for uid=${uid}:`, (e as Error).message);
    return null;
  }
}

/**
 * Get quota usage for a mailbox.
 */
export async function getMailboxQuota(resourceId: string): Promise<{
  totalUsage: number;
  totalLimit: number;
  totalPercentage: number;
  supported: boolean;
}> {
  const res = await quotaApi().getQuota(resourceId);
  const data = (res.data as any).data ?? {};
  return {
    totalUsage: data.totalUsage ?? 0,
    totalLimit: data.totalLimit ?? 0,
    totalPercentage: data.totalPercentage ?? 0,
    supported: data.supported ?? false,
  };
}

/**
 * Send an email via the Hostinger Mail API.
 * Returns success status (the API returns void on success; throws on failure).
 */
export async function sendViaApi(
  resourceId: string,
  opts: {
    to: string;
    subject: string;
    text: string;
    cc?: string;
    html?: string;
    displayName?: string;
  },
): Promise<{ delivered: boolean }> {
  // SDK declares all V1SendRequest fields required; the API treats missing
  // ones as absent, so cast a partial object.
  const req: Record<string, unknown> = {
    to: [opts.to],
    subject: opts.subject,
    text: opts.text,
    displayName: opts.displayName || 'EasyLegal MailPortal',
  };
  if (opts.cc) req.cc = [opts.cc];
  if (opts.html) req.html = opts.html;

  await sendApi().sendEmail(resourceId, req as any);
  return { delivered: true };
}
