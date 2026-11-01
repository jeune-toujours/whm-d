import assert from 'node:assert/strict';
import { scanBarcode } from './camera-smoke.mjs';

export async function verifyInventoryFlow({panel,context,backend,itemID}) {
  const headers={Origin:backend}, marker=`INV-BROWSER-${Date.now()}`, unaccounted=`INV-${Date.now()}`;
  const post=async(path,data)=>{const r=await context.request.post(`${backend}/api${path}`,{data,headers});assert.equal(r.status(),201,`Create inventory browser fixture ${path}`);return(await r.json()).doc;};
  const warehouse=await post('/warehouses',{name:marker,active:true});
  const cells=await Promise.all([1,2,3].map(i=>post('/cells',{name:`${marker}-${i}`,barcode:`${marker}-BAR-${i}`,warehouse:warehouse.id,zone:'INV-SMOKE',capacity:10,active:true})));
  const itemBefore=await(await context.request.get(`${backend}/api/storage-items/${itemID}?depth=0`,{headers})).json();
  await panel.goto(`${backend}/admin/warehouse/inventory`);
  await panel.getByRole('button',{name:'Создать инвентаризацию',exact:true}).click();
  const create=panel.getByRole('form',{name:'Создание инвентаризации'});
  await create.getByLabel('Поиск ячейки',{exact:true}).fill(marker);
  for(const cell of cells) await create.getByRole('checkbox',{name:`Выбрать ячейку ${cell.name}`,exact:true}).check();
  assert.match(await create.getByRole('status').filter({hasText:'Выбрано ячеек'}).innerText(),/3/);
  async function verifyLayout(label) {
    for(const theme of ['light','dark']) for(const width of [320,390,768,1440]) {
      await panel.setViewportSize({width,height:900});await panel.evaluate(theme=>document.documentElement.setAttribute('data-theme',theme),theme);
      assert.ok(await panel.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),`${label}: ${theme}, ${width}px`);
    }
    await panel.setViewportSize({width:1280,height:900});
  }
  await verifyLayout('Inventory selection');
  await create.getByRole('button',{name:'Запустить инвентаризацию',exact:true}).click();
  await panel.waitForURL(url=>Boolean(url.searchParams.get('session')));
  const id=new URL(panel.url()).searchParams.get('session');
  const progress=panel.getByRole('region',{name:'Прогресс инвентаризации'});
  await progress.getByText(/Проверено 0\/3/).waitFor();
  await verifyLayout('Pending inventory');
  // Hold one periodic GET with the old 0/3 snapshot until the first POST has
  // committed. A late read must not resurrect an already closed check form.
  let releaseStale, markStaleReady, held=false;
  const released=new Promise(resolve=>{releaseStale=resolve;});
  const staleReady=new Promise(resolve=>{markStaleReady=resolve;});
  const detailURL=`${backend}/api/v1/inventory/${id}`;
  await panel.bringToFront();
  const nextPoll=panel.waitForRequest(detailURL);
  await panel.route(detailURL,async route=>{
    const response=await route.fetch();
    if(!held){held=true;markStaleReady();await released;}
    await route.fulfill({response});
  });
  await nextPoll;await staleReady;
  const first=panel.getByRole('region',{name:`Ячейка ${cells[0].name}`,exact:true});
  await scanBarcode(panel,first,'Добавить найденный код',unaccounted);
  await first.getByLabel('Комментарий к проверке').fill('Проверка: обнаружен неучтённый предмет.');
  // Saving must include a camera-filled code even without the optional Add button.
  await first.getByRole('button',{name:'Сохранить проверку',exact:true}).click();
  await first.getByText('Расхождение',{exact:true}).waitFor();
  await progress.getByText(/Проверено 1\/3/).waitFor();
  const staleDelivered=panel.waitForResponse(response=>response.url()===detailURL);
  releaseStale();await staleDelivered;await panel.waitForTimeout(150);
  assert.match(await progress.innerText(),/Проверено 1\/3/,'Late polling response cannot roll progress back');
  assert.equal(await first.getByRole('button',{name:'Сохранить проверку',exact:true}).count(),0,'Closed check stays read-only after stale poll');
  await panel.unroute(detailURL);
  for(const cell of cells.slice(1)) {
    const row=panel.getByRole('region',{name:`Ячейка ${cell.name}`,exact:true});
    await row.getByRole('button',{name:'Сохранить проверку',exact:true}).click();
    await row.getByText('Соответствует',{exact:true}).waitFor();
  }
  await progress.getByText(/Проверено 3\/3/).waitFor();
  await progress.getByText('Завершена с расхождениями',{exact:true}).waitFor();
  await verifyLayout('Closed inventory');
  const detail=await(await context.request.get(`${backend}/api/v1/inventory/${id}`,{headers})).json();
  assert.deepEqual(detail.cells.map(row=>row.cellID).sort(),cells.map(cell=>cell.id).sort(),'Exactly selected three cells');
  assert.equal(detail.operation.discrepancyCount,1);assert.equal(detail.cells.find(row=>row.cellID===cells[0].id).observedCodes[0],unaccounted);
  assert.ok(detail.cells.every(row=>row.checkedByID&&row.checkedAt));
  const itemAfter=await(await context.request.get(`${backend}/api/storage-items/${itemID}?depth=0`,{headers})).json();
  assert.deepEqual(itemAfter,itemBefore,'Inventory does not alter the stored test item');
  assert.equal((await context.request.get(`${backend}/api/v1/inventory/${id}`,{headers:{...headers,'X-WHM-Client':'1'}})).status(),403,'Client cannot read inventory in the same browser');
  await panel.getByRole('link',{name:'К списку инвентаризаций',exact:true}).click();
  await panel.getByLabel('Показать',{exact:true}).selectOption('closed');
  await panel.getByRole('link',{name:detail.operation.number,exact:true}).waitFor();
  await verifyLayout('Inventory history');
  console.log('Inventory: manual three-cell launch, optional real camera, discrepancy, progress, immutable stock, history, client denial; 320/390/768/1440 px in both themes passed.');
}
