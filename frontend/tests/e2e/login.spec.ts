import { test, expect } from '@playwright/test';

test.describe('Email Portal - E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('home redirects to login', async ({ page }) => {
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('h1')).toContainText(/Email Portal/i);
    await expect(page.locator('input[data-testid="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('login form accepts input', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.locator('input[data-testid="email"]').fill('user@example.com');
    await page.locator('input[type="password"]').fill('secret123');
    await expect(page.locator('input[data-testid="email"]')).toHaveValue('user@example.com');
    await expect(page.locator('input[type="password"]')).toHaveValue('secret123');
  });

  test('login with invalid credentials shows error or stays on page', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.locator('input[data-testid="email"]').fill('invalid@test.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.locator('button[type="submit"]').click();
    // Should not crash - either show error or stay on login
    await expect(page.locator('input[data-testid="email"]')).toBeVisible();
  });
});
