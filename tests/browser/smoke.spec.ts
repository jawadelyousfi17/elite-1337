import { test, expect } from '@playwright/test';
test('mobile leaderboard renders without horizontal overflow and filters remain accessible', async ({ page }, testInfo) => {
  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('leaderboard-mobile.png'), fullPage: true });
  await page.goto('/leaderboard?campus=21&q=demo-student');
  await expect(page.getByRole('link', { name: 'demo-student (opens in a new tab)', exact: true })).toBeVisible();
});
test('submitted queue explains status, renders a student and refreshes', async ({ page }, testInfo) => {
  await page.goto('/corrections?campus=21');
  await expect(page.getByRole('heading', { name: 'Who submitted a project?' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'NetPractice' })).toBeVisible();
  const refresh = page.getByRole('button', { name: 'Refresh', exact: true });
  await refresh.click();
  await expect(refresh).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('waiting-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath('waiting-desktop.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
