import { chromium } from '@playwright/test';

const base = process.env.WHM_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const routes = ['preview', 'signin', 'home', 'item/BX-104', 'order', 'intake', 'return', 'history', 'support', 'profile', 'subscription', 'payments'];
for (const route of routes) {
  await page.goto(`${base}/#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(route === 'signin' ? 1300 : 350);
  const heading = (await page.locator('h1').first().textContent().catch(() => ''))?.replace(/\s+/g, ' ').trim() || '—';
  console.log(`${route.padEnd(19)} ${heading}`);
  if (heading === '—') errors.push(`${route}: heading missing`);
  if (process.env.WHM_SCREENSHOT && route === (process.env.WHM_SCREENSHOT_ROUTE || 'home')) await page.screenshot({ path: process.env.WHM_SCREENSHOT, fullPage: true });
}

await page.goto(`${base}/#/profile`, { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: 'Изменить способ оплаты' }).click();
if (await page.locator('input[autocomplete^="cc-"]').count()) errors.push('Profile asks for card details inside WHM');

await page.setViewportSize({ width: 390, height: 844 });
for (const route of routes) {
  await page.goto(`${base}/#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(150);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  if (width > 390) errors.push(`${route}: horizontal overflow at mobile width (${width}px)`);
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Smoke check passed.');
