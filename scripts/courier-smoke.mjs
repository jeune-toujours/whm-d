import assert from 'node:assert/strict';
import {expect} from '@playwright/test';

export const manualCourierAddress='Садовническая набережная 1';
export async function verifyCourierAddressFields(page){
  const address=page.locator('#address-search'),phone=page.locator('#contact-phone'),next=page.locator('.sticky-bar .primary-button');
  await address.fill(manualCourierAddress);
  for(const [width,value] of [[1440,'9990000001'],[390,'+7 (999) 000-00-01'],[320,'8 (999) 000-00-01']]){
    await page.setViewportSize({width,height:900});await phone.fill(value);
    await expect(phone).toHaveValue('9990000001');await expect(next).toBeEnabled();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Courier form fits ${width}px`);
  }
  await phone.fill('999000000');await expect(next).toBeDisabled();
  await phone.fill('+7 999 000 00 012');await expect(next).toBeDisabled();
  await phone.fill('+1 202 555 0123');await expect(next).toBeDisabled();
  await phone.fill('9990000001');await expect(next).toBeEnabled();
  await phone.fill('9990000001abc');await expect(phone).toHaveValue('9990000001');await expect(next).toBeEnabled();
  await address.fill('');await expect(next).toBeDisabled();
  await address.fill('Дом 1');await expect(next).toBeDisabled();
  await address.fill('Химки, Ленинградское шоссе, 5');await expect(next).toBeDisabled();
  await address.fill('Садовническая  набережная 1');await expect(next).toBeEnabled();
  await page.getByLabel('Квартира',{exact:true}).fill('20');await page.getByLabel('Домофон',{exact:true}).fill('й');
  await page.getByLabel('Подъезд',{exact:true}).fill('5');await page.getByLabel('Этаж',{exact:true}).fill('12');
  await page.getByLabel('Комментарий курьеру',{exact:true}).fill('Проверка курьерской формы');
  await page.reload();await expect(page.getByRole('heading',{name:'Адрес забора вещей',exact:true})).toBeVisible();
  await expect(phone).toHaveValue('9990000001');await expect(next).toBeEnabled();
  await next.click();
  await expect(page.locator('.review-submit')).toBeVisible();
  assert.ok((await page.locator('body').innerText()).includes(manualCourierAddress),'Manual address survives review and restored draft');
  console.log('Courier address: manual entry, 10 digits/+7/8, malformed input, explicit blocked zone, draft restore and 320/390/1440px passed.');
}
