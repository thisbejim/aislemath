import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads with a clear first-use workflow and no console errors', async ({ page }) => {
  const errors = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await expect(page).toHaveTitle(/Grocery Unit Price Calculator/);
  await expect(page.getByRole('heading', { name: 'Grocery unit price calculator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Which option is the better deal?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add another option' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('compares mixed package sizes, ranks the winner, and downloads CSV', async ({ page }) => {
  await page.locator('[data-index="0"][data-field="name"]').fill('Large box');
  await page.locator('[data-index="0"][data-field="price"]').fill('8.99');
  await page.locator('[data-index="0"][data-field="amount"]').fill('24');
  await page.locator('#add-item').click();
  await page.locator('[data-index="1"][data-field="name"]').fill('Mid box');
  await page.locator('[data-index="1"][data-field="price"]').fill('5.49');
  await page.locator('[data-index="1"][data-field="amount"]').fill('18');
  await expect(page.locator('#comparison-wrap')).toBeVisible();
  await expect(page.locator('.comparison-table')).toContainText('Mid box');
  await expect(page.locator('.winner-tag')).toHaveCount(1);
  await expect(page.locator('#result-kind')).toContainText('2 options compared');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('shelfwise-comparison.csv');
  expect(await download.path()).toBeTruthy();
});

test('applies a multi-buy and keeps the bundle math visible', async ({ page }) => {
  await page.locator('[data-index="0"][data-field="name"]').fill('Pasta deal');
  await page.locator('[data-index="0"][data-field="price"]').fill('3.50');
  await page.locator('[data-index="0"][data-field="amount"]').fill('500');
  await page.locator('[data-index="0"][data-field="deal"]').selectOption('multi');
  await page.locator('[data-index="0"][data-field="dealQty"]').fill('2');
  await page.locator('[data-index="0"][data-field="dealPrice"]').fill('5');
  await page.locator('#add-item').click();
  await page.locator('[data-index="1"][data-field="name"]').fill('Pasta regular');
  await page.locator('[data-index="1"][data-field="price"]').fill('2.80');
  await page.locator('[data-index="1"][data-field="amount"]').fill('500');
  await expect(page.locator('[data-index="0"][data-field="dealQty"]')).toHaveValue('2');
  await expect(page.locator('.comparison-table')).toContainText('Pasta deal');
  await expect(page.locator('.item-row').first()).toContainText('Multi-buy');
  await expect(page.locator('#insight')).toContainText('best value');
});

test('loads the cereal example and copies a share link', async ({ page }) => {
  await page.locator('[data-example="cereal"]').click();
  await expect(page.locator('.item-row')).toHaveCount(3);
  await expect(page.locator('#comparison-wrap')).toBeVisible();
  await page.locator('#share-result').click();
  await expect(page).toHaveURL(/#s=/);
  await expect(page.locator('#toast')).toContainText('Share link copied');
});

test('has no automated accessibility violations on desktop and mobile', async ({ page }) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
