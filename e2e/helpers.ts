import { execSync } from 'node:child_process';
import { Page, expect } from '@playwright/test';

export const CUSTOMER = { email: 'budi@clienteasylegal.co.id', password: 'Customer123!' };
export const ADMIN = { email: 'admin@clienteasylegal.co.id', password: 'Admin123!' };

// Specs share one SQLite file and mutate it (send, delete, mark read). Each spec
// file resets to the seed so counts are asserted against a known dataset.
export function resetDb() {
  execSync('npm run seed', { stdio: 'pipe' });
}

// Unified login: role inferred from email, so only the account differs.
export async function login(
  page: Page,
  who: { email: string; password: string } = CUSTOMER
) {
  const isAdmin = who.email === ADMIN.email || who.email === 'officer@clienteasylegal.co.id';
  await page.goto('/login');
  await page.getByTestId('email').fill(who.email);
  await page.getByTestId('password').fill(who.password);
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(isAdmin ? /\/admin/ : /\/inbox/);
}

export async function loginAsCustomer(page: Page) {
  await login(page, CUSTOMER);
  await expect(page.getByTestId('message-list')).toBeVisible();
}
