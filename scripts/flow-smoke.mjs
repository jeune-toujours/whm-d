import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import {verifyCourierAddressFields} from './courier-smoke.mjs';

const base = process.env.WHM_BASE_URL || 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
const browser = await chromium.launch({ executablePath, headless: true });

async function pageFor(route) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#/${route}`);
  return { page, errors };
}

try {
  {
    const {page,errors}=await pageFor('intake');
    await page.locator('.service-card').filter({hasText:'Я упакую сам'}).getByRole('button',{name:'Выбрать',exact:true}).click();
    await page.getByRole('button',{name:/Увеличить количество/}).first().click();
    await page.locator('.sticky-bar .primary-button').click();
    await page.getByRole('button',{name:'Пропустить',exact:true}).click();await page.getByRole('button',{name:'Пропустить',exact:true}).click();
    await page.getByRole('button',{name:/Курьер заберёт/}).click();
    await page.locator('.slot-grid button:not([disabled])').first().click();await page.locator('.sticky-bar .primary-button').click();
    await verifyCourierAddressFields(page);assert.deepEqual(errors,[]);await page.close();
  }
  {
    const { page, errors } = await pageFor('intake');
    await page.locator('.service-card .card-link-button').first().click();
    await page.locator('.item-card .stepper button:last-child').first().click();
    await page.locator('.sticky-bar .primary-button').click();
    await page.locator('.sticky-bar .primary-button').click();
    await page.locator('main .text-button').first().click();
    await page.locator('.slot-grid button:not([disabled])').first().click();
    await page.locator('.sticky-bar .primary-button').click();
    await page.locator('.saved-address').click();
    await page.locator('.sticky-bar .primary-button').click();
    console.log('Intake review reached');
    await page.locator('.terms-card .custom-checkbox').click();
    await page.locator('.review-submit').click();
    await page.locator('.success-actions .primary-button').waitFor({ timeout: 10000 });
    await page.locator('.success-actions .primary-button').click();
    assert.equal(new URL(page.url()).hash, '#/order');
    assert.match(await page.locator('body').innerText(), /WHM-S-/);
    assert.deepEqual(errors, []);
    console.log('Intake → active order: passed');
    await page.close();
  }

  {
    const { page, errors } = await pageFor('item/BX-104');
    await page.locator('.summary .primary').click();
    assert.equal(new URL(page.url()).hash, '#/return');
    assert.equal(await page.locator('.storage-card input[type=checkbox]').first().isChecked(), true);
    await page.locator('.panel-actions .primary-button').click();
    await page.locator('.method-select').first().click();
    await page.locator('.panel-actions .primary-button').click();
    await page.locator('input[autocomplete="street-address"]').fill('Садовническая набережная 1');
    await page.locator('.phone-field input').fill('8 (999) 000-00-01');
    assert.equal(await page.locator('.phone-field input').inputValue(),'999 000 00 01');
    await page.locator('.date-row button').first().click();
    await page.locator('.slot-grid button').first().click();
    await page.locator('.panel-actions .primary-button').click();
    await page.locator('.consent-item input').check();
    await page.locator('.panel-actions .primary-button').click();
    await page.locator('.success-actions .primary-button').waitFor({ timeout: 10000 });
    await page.locator('.success-actions .primary-button').click();
    assert.equal(new URL(page.url()).hash, '#/order');
    assert.match(await page.locator('body').innerText(), /WHM-R-/);
    assert.deepEqual(errors, []);
    console.log('Item → return → active order: passed');
    await page.close();
  }
} finally {
  await browser.close();
}
