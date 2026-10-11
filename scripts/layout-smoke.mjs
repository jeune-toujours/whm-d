import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createDemo } from '../src/demo.js';

const base = process.env.WHM_BASE_URL || 'http://127.0.0.1:4173';
const executablePath = process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined);
const browser = await chromium.launch({ executablePath, headless:true });
const errors = [];
let checked = 0;
const viewports = [[320,740],[360,800],[390,844],[768,1024],[1024,768],[1440,900],[844,390]];
async function inspect(page, name) {
  await page.waitForTimeout(120);
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const rect = e => e.getBoundingClientRect();
    const visible = e => rect(e).width > 0 && getComputedStyle(e).visibility !== 'hidden';
    const problems = [];
    if (document.documentElement.scrollWidth > width + 1) problems.push('horizontal page overflow');
    for (const button of document.querySelectorAll('button[aria-label]')) {
      if (!/^Назад/.test(button.getAttribute('aria-label')) || !visible(button)) continue;
      const b = rect(button), svg = button.querySelector('svg'), s = svg && rect(svg);
      if (b.width < 40 || b.height < 40) problems.push('back button shrinks below 40 px');
      if (s && (Math.abs(b.x+b.width/2-s.x-s.width/2)>1 || Math.abs(b.y+b.height/2-s.y-s.height/2)>1)) problems.push('back icon is off centre');
    }
    for (const header of document.querySelectorAll('header')) {
      const h=rect(header); if (!visible(header)) continue;
      for (const button of header.querySelectorAll('button')) { const b=rect(button); if (visible(button) && (b.x<h.x-1 || b.right>h.right+1)) problems.push('header control leaves its container'); }
    }
    for (const row of document.querySelectorAll('.otp-row')) {
      const b=rect(row);
      for (const cell of row.querySelectorAll('input')) { const c=rect(cell); if (c.x<b.x-1 || c.right>b.right+1) problems.push('OTP cells leave their form'); }
    }
    for (const selector of ['.detail-page', '.subscription-page', '.info']) {
      const page=document.querySelector(selector), back=page?.querySelector('.navigation-back'), main=page?.querySelector('.shell, .content');
      if (back && main) { const b=rect(back),m=rect(main);const left=m.x+parseFloat(getComputedStyle(main).paddingLeft);if(Math.abs(b.x-left)>1)problems.push('back button is off the content grid'); }
    }
    return problems;
  });
  errors.push(...result.map(message=>`${name}: ${message}`));
  checked++;
}
try {
  for (const theme of ['bumblebee','halloween']) {
    const context=await browser.newContext({ reducedMotion:'reduce' });
    const fixture=createDemo();
    // Exercise real UUID-length identifiers and long values, not just short demo labels.
    fixture.units[0].id='86b6e7f2-c693-4d18-a1d8-97f7b4b7c64c';
    fixture.units[0].internalID='WHM-REGRESSION-001';
    fixture.units[0].title='Коробка с зимней одеждой и сезонными принадлежностями';
    fixture.units[0].description='Длинное описание содержимого коробки для проверки переноса текста на узком экране';
    await context.addInitScript(({theme,fixture})=>{localStorage.setItem('whm-theme',theme);localStorage.setItem('whm-d-client-preview-v1',JSON.stringify(fixture));},{theme,fixture});
    const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    for(const [width,height]of viewports){
      await page.setViewportSize({width,height});
      for(const route of ['home',`item/${fixture.units[0].id}`,'order','intake','return','history','support','profile','subscription','payments','info']){
        await page.goto(`${base}/#/${route}`,{waitUntil:'domcontentloaded'});
        await page.locator('h1').first().waitFor();await inspect(page,`${theme}/${width}x${height}/${route}`);
      }
      if([320,390,768,1440,844].includes(width)){
        await page.evaluate(()=>localStorage.removeItem('whm-7-storage-intake-draft'));
        // Navigate away first: the route matrix ends on a different screen today,
        // and this also makes repeated checks independent of an open wizard.
        await page.goto(`${base}/#/home`);
        await page.goto(`${base}/#/intake`);
        await page.locator('.service-card').filter({hasText:'Я упакую сам'}).getByRole('button',{name:'Выбрать',exact:true}).click();await inspect(page,`${width}/intake/items`);
        await page.getByRole('button',{name:/Увеличить количество/}).first().click();await page.locator('.sticky-bar .primary-button').click();await inspect(page,`${width}/intake/options`);
        await page.getByRole('button',{name:'Пропустить',exact:true}).click();await inspect(page,`${width}/intake/insurance`);
        await page.getByRole('button',{name:'Пропустить',exact:true}).click();await inspect(page,`${width}/intake/logistics`);
        await page.getByRole('button',{name:/Я привезу сам/}).click();await page.getByRole('button',{name:'Перейти к проверке',exact:true}).click();await inspect(page,`${width}/intake/review`);
        await page.getByRole('button',{name:'Назад',exact:true}).click();await inspect(page,`${width}/intake/back`);
        await page.goto(`${base}/#/return`);
        await page.locator('.storage-card .storage-select').first().click();
        assert.equal(await page.locator('.storage-card input[type=checkbox]').first().isChecked(),true,'Card tap selects a return item');
        await page.getByRole('button',{name:'Продолжить',exact:true}).filter({visible:true}).first().click();await inspect(page,`${width}/return/method`);
        await page.getByRole('button',{name:/Заберу со склада/}).click();await page.getByRole('button',{name:'Продолжить',exact:true}).filter({visible:true}).first().click();await inspect(page,`${width}/return/schedule`);
        await page.locator('.date-row button:not(:disabled)').first().click();await page.locator('.slot-grid button:not(:disabled)').first().click();await page.getByRole('button',{name:'Продолжить',exact:true}).filter({visible:true}).first().click();await inspect(page,`${width}/return/review`);
        await page.getByRole('button',{name:'Назад',exact:true}).click();await inspect(page,`${width}/return/back`);
        await page.goto(`${base}/#/support`);await page.getByRole('button',{name:/Проблема с приложением/}).click();await inspect(page,`${width}/support/form`);
        await page.goto(`${base}/#/profile`);await page.getByRole('button',{name:'Изменить',exact:true}).first().click();await page.getByRole('dialog').waitFor();await inspect(page,`${width}/profile/dialog`);
      }
    }
    await context.close();
  }
  assert.deepEqual(errors,[]);
  console.log(`Layout: ${checked} states, seven viewports, both themes, wizard back navigation and dialogs passed.`);
}finally{await browser.close();}
