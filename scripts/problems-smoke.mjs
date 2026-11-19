import assert from 'node:assert/strict';

export async function verifyProblemsFlow({ panel, page, backend, base, order, image }) {
  const item = order.items[0], description = `Повреждение коробки при поступлении · ${Date.now()}`;
  await panel.goto(`${backend}/admin/warehouse/receive`);
  const intake = panel.locator('.whm-order').filter({ hasText:order.number });
  await intake.getByRole('link',{name:'Зафиксировать повреждение при поступлении'}).first().click();
  const contextResponse = await panel.request.get(`${backend}/api/v1/problems/context?orderID=${order.id}`,{headers:{Origin:backend}});
  assert.equal(contextResponse.status(),200); const evidenceEnabled = (await contextResponse.json()).evidenceEnabled;
  await panel.getByLabel('Опись повреждения').fill(description);
  if (evidenceEnabled) await panel.getByLabel('Фото, видео или документы').setInputFiles(image);
  else { await panel.getByText('Материалы временно недоступны. Можно сохранить описание повреждения без файлов.',{exact:true}).waitFor(); assert.equal(await panel.locator('input[type=file]').count(),0); }
  await panel.getByLabel('Повреждение обнаружено при поступлении').check();
  const saved = panel.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/problems' && r.request().method()==='POST');
  await panel.getByRole('button',{name:'Сохранить внутреннюю фиксацию'}).click();
  const response = await saved; assert.equal(response.status(),200,'Save damage record');
  const { report } = await response.json();
  await panel.getByRole('heading',{name:report.number,exact:true}).waitFor();
  await panel.getByText(description,{exact:true}).waitFor();
  assert.equal(report.status,'pending'); assert.equal(report.ticketID,'');
  await panel.getByRole('button',{name:'Подтвердить кейс и уведомить клиента',exact:true}).waitFor();
  const clientHeaders={Origin:base,'X-WHM-Client':'1'};
  const internalHistory=await page.request.get(`${backend}/api/v1/items/${item.id}/problems`,{headers:clientHeaders});
  assert.equal(internalHistory.status(),200);assert.deepEqual((await internalHistory.json()).reports,[],'Unconfirmed damage hidden from client');
  const before=await page.request.get(`${backend}/api/v1/dashboard`,{headers:clientHeaders});
  assert.ok(!(await before.json()).tickets.some(t=>t.shortDescription.includes(report.number)),'No support case before confirmation');
  for (const width of [320,390,1440]) {
    await panel.setViewportSize({width,height:900});
    assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Pending case and confirmation button at ${width}px`);
  }
  const publish=panel.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/problems/${report.id}/publish`&&r.request().method()==='POST');
  await panel.getByRole('button',{name:'Подтвердить кейс и уведомить клиента',exact:true}).click();
  const published=await publish;assert.equal(published.status(),200);const confirmed=(await published.json()).report;
  assert.equal(confirmed.status,'published');assert.ok(confirmed.ticketID);
  await panel.getByRole('link',{name:'Открыть обращение клиента',exact:true}).waitFor();
  for (const width of [320,390,1440]) {
    await panel.setViewportSize({width,height:900});
    assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Damage detail at ${width}px`);
  }
  await panel.goto(`${backend}/admin/warehouse/problems`);
  await panel.getByLabel('Показать',{exact:true}).selectOption('published');
  const search = panel.getByLabel('Поиск по номеру акта, заказа или вещи');
  await search.fill(report.number);
  await panel.getByRole('link',{name:report.number,exact:true}).waitFor();
  assert.equal(await search.inputValue(),report.number,'Search retains input while fetching');
  await page.goto(`${base}/#/item/${item.id}`);
  await page.getByRole('region',{name:'Повреждения при поступлении'}).getByText(description,{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Client damage history fits mobile');
  const dashboard = await page.request.get(`${backend}/api/v1/dashboard`,{headers:{Origin:base,'X-WHM-Client':'1'}});
  assert.equal(dashboard.status(),200);
  const ticket = (await dashboard.json()).tickets.find(t=>t.id===confirmed.ticketID);
  assert.ok(ticket && ticket.messages.some(m=>m.text.includes(description)),'Client receives in-app notification');
  await page.getByRole('button',{name:'Открыть поддержку',exact:true}).click();
  await page.locator('.thread-message').filter({hasText:description}).waitFor();
  await page.goto(`${base}/#/order/${order.id}`);
  console.log(`Problem orders: internal capture, ${evidenceEnabled ? 'private attachment' : 'text-only staging'}, hidden client history/support until confirmation, single case publication, search and mobile widths passed.`);
}
