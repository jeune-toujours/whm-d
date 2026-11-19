import assert from 'node:assert/strict';

export async function verifyProblemsFlow({ panel, page, backend, base, order, image }) {
  const item = order.items[0], description = `Повреждение коробки при поступлении · ${Date.now()}`;
  await panel.goto(`${backend}/admin/warehouse/receive`);
  const intake = panel.locator('.whm-order').filter({ hasText:order.number });
  await intake.getByRole('link',{name:'Зафиксировать повреждение при поступлении'}).first().click();
  await panel.getByLabel('Опись повреждения').fill(description);
  await panel.getByLabel('Фото, видео или документы').setInputFiles(image);
  await panel.getByLabel('Повреждение обнаружено при поступлении').check();
  const saved = panel.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/problems' && r.request().method()==='POST');
  await panel.getByRole('button',{name:'Сохранить и уведомить клиента'}).click();
  const response = await saved; assert.equal(response.status(),200,'Save damage record');
  const { report } = await response.json();
  await panel.getByRole('heading',{name:report.number,exact:true}).waitFor();
  await panel.getByText(description,{exact:true}).waitFor();
  assert.equal(await panel.getByText(/Ожидает подтвержден|Подтвердить акт/).count(),0,'No employee approvals');
  for (const width of [320,390,1440]) {
    await panel.setViewportSize({width,height:900});
    assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Damage detail at ${width}px`);
  }
  await panel.goto(`${backend}/admin/warehouse/problems`);
  const search = panel.getByLabel('Поиск по номеру акта, заказа или вещи');
  await search.fill(report.number);
  await panel.getByRole('link',{name:report.number,exact:true}).waitFor();
  assert.equal(await search.inputValue(),report.number,'Search retains input while fetching');
  await page.goto(`${base}/#/item/${item.id}`);
  await page.getByRole('region',{name:'Повреждения при поступлении'}).getByText(description,{exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Client damage history fits mobile');
  const dashboard = await page.request.get(`${backend}/api/v1/dashboard`,{headers:{Origin:base,'X-WHM-Client':'1'}});
  assert.equal(dashboard.status(),200);
  const ticket = (await dashboard.json()).tickets.find(t=>t.id===report.ticketID);
  assert.ok(ticket && ticket.messages.some(m=>m.text.includes(description)),'Client receives in-app notification');
  await page.getByRole('button',{name:'Открыть поддержку',exact:true}).click();
  await page.locator('.thread-message').filter({hasText:description}).waitFor();
  await page.goto(`${base}/#/order/${order.id}`);
  console.log('Problem orders: intake shortcut, real attachment, immediate save, search, client history/notification, mobile widths; no approvals passed.');
}
