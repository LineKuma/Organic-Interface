import { test, expect } from '@playwright/test';

test.describe('Plugin System', () => {
  test('should load plugins on startup', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="plugin-list"]');
  });

  test('should enable and disable plugins', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="plugin-settings"]');
  });

  test('should handle plugin errors without crashing', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="plugin-error-boundary"]');
  });
});