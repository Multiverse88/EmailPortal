/**
 * Utility for computing account and storage retention status.
 *
 * Policy:
 * - Customer account and storage data are retained for 90 days (3 months) from creation.
 * - During the final 30 days (1 month remaining), a warning status is activated,
 *   prompting the user to backup their data and informing that inactive account issues
 *   can be resolved via support tickets processed within 1x24 hours.
 */

export const RETENTION_DAYS = 90;
export const WARNING_THRESHOLD_DAYS = 30;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface AccountRetentionInfo {
  createdAt: string;
  expiresAt: string;
  retentionDays: number;
  remainingDays: number;
  elapsedDays: number;
  percentUsed: number;
  isExpiringSoon: boolean;
  isExpired: boolean;
  warningThresholdDays: number;
  policyNotice: string;
  warningNotice?: string;
}

export function computeRetention(
  createdAtInput: Date | string,
  referenceDate: Date = new Date()
): AccountRetentionInfo {
  const createdDate = new Date(createdAtInput);
  const now = referenceDate;

  // Expiration date: exactly 90 days from creation
  const expiresDate = new Date(createdDate.getTime() + RETENTION_DAYS * MS_PER_DAY);

  const diffMs = expiresDate.getTime() - now.getTime();
  const rawRemainingDays = Math.ceil(diffMs / MS_PER_DAY);
  const remainingDays = Math.max(0, Math.min(RETENTION_DAYS, rawRemainingDays));

  const elapsedMs = now.getTime() - createdDate.getTime();
  const rawElapsedDays = Math.floor(elapsedMs / MS_PER_DAY);
  const elapsedDays = Math.max(0, Math.min(RETENTION_DAYS, rawElapsedDays));

  const isExpired = diffMs <= 0;
  const isExpiringSoon = !isExpired && remainingDays <= WARNING_THRESHOLD_DAYS;

  const percentUsed = Math.min(
    100,
    Math.max(0, Math.round(((RETENTION_DAYS - remainingDays) / RETENTION_DAYS) * 100))
  );

  const policyNotice =
    'Akun dan file penyimpanan ini hanya bertahan selama 3 bulan semenjak akun dibuat.';

  let warningNotice: string | undefined = undefined;
  if (isExpiringSoon) {
    warningNotice = `Perhatian: Dalam ${remainingDays} hari ke depan (kurang dari 1 bulan), akun dan file penyimpanan ini akan bersifat non-aktif. Harap segera backup berkas penting ke dalam penyimpanan Anda sendiri. Jika terjadi kendala setelah akun non-aktif, silakan membuka tiket support yang akan diproses 1x24 jam.`;
  } else if (isExpired) {
    warningNotice =
      'Akun dan file penyimpanan Anda telah melewati masa aktif 3 bulan dan berstatus non-aktif. Harap segera membuka tiket support untuk pemulihan atau kendala data yang akan diproses 1x24 jam.';
  }

  return {
    createdAt: createdDate.toISOString(),
    expiresAt: expiresDate.toISOString(),
    retentionDays: RETENTION_DAYS,
    remainingDays,
    elapsedDays,
    percentUsed,
    isExpiringSoon,
    isExpired,
    warningThresholdDays: WARNING_THRESHOLD_DAYS,
    policyNotice,
    warningNotice,
  };
}
