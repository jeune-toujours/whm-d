import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
const { Code128Reader } = requireBackend('@zxing/library');

// Feed real Code 128 pixels into a video stream; the application decoder is not mocked.
export async function installTestCamera(page) {
  await page.addInitScript(({ patterns }) => {
    window.whmCameraTest = { mode:'barcode', code:'', delay:0, calls:0, streams:[], constraints:[] };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable:true, value:async constraints => {
      const test=window.whmCameraTest; test.calls++; test.constraints.push(constraints);
      const {mode,code,delay}=test;
      if (mode==='denied') throw new DOMException('Test permission denial','NotAllowedError');
      if (delay) await new Promise(resolve=>setTimeout(resolve,delay));
      const canvas=document.createElement('canvas'); canvas.width=960; canvas.height=540;
      const draw=()=>{
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,960,540);
        if(mode==='blank')return;
        const symbols=[104,...[...code].map(c=>c.charCodeAt(0)-32)];
        const checksum=(104+symbols.slice(1).reduce((sum,value,index)=>sum+value*(index+1),0))%103;
        const widths=[...symbols,checksum,106].flatMap(symbol=>patterns[symbol]);
        let x=(960-widths.reduce((a,b)=>a+b,0)*3)/2;ctx.fillStyle='#000';
        widths.forEach((width,index)=>{if(index%2===0)ctx.fillRect(x,160,width*3,220);x+=width*3;});
      };
      draw(); const stream=canvas.captureStream(10),timer=setInterval(draw,100);test.streams.push(stream);
      for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
      return stream;
    }});
  }, { patterns:Code128Reader.CODE_PATTERNS.map(pattern=>Array.from(pattern)) });
}

export async function scanBarcode(page, form, label, code) {
  await page.evaluate(code=>Object.assign(window.whmCameraTest,{mode:'barcode',code,delay:0}),code);
  await form.getByRole('button',{name:`Сканировать камерой: ${label.toLowerCase()}`,exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.whm-scanner[open]'));
  assert.equal(await form.getByLabel(label,{exact:true}).inputValue(),code,'Real Code 128 decoding fills the intended field');
  await page.waitForFunction(()=>window.whmCameraTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
  assert.ok(await page.evaluate(()=>window.whmCameraTest.constraints.at(-1).video.facingMode.ideal==='environment'),'Camera prefers the rear lens');
}

export async function verifyCameraLifecycle(page, form) {
  const field=form.getByLabel('Скан вещи',{exact:true}),trigger=form.getByRole('button',{name:'Сканировать камерой: скан вещи',exact:true});
  await field.fill('MANUAL-KEEP');
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>Object.assign(window.whmCameraTest,{mode:'denied',delay:0}));
  await trigger.click(); const dialog=page.getByRole('dialog');
  await dialog.getByRole('alert').filter({hasText:'Разрешите доступ к камере'}).waitFor();
  assert.ok(await dialog.evaluate(element=>{const r=element.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&element.scrollWidth<=element.clientWidth;}),'Camera dialog fits a mobile screen');
  await page.evaluate(()=>Object.assign(window.whmCameraTest,{mode:'blank'}));
  await dialog.getByRole('button',{name:'Повторить',exact:true}).click();
  await page.waitForFunction(()=>window.whmCameraTest.streams.some(stream=>stream.getTracks().some(track=>track.readyState==='live')));
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await page.waitForFunction(()=>window.whmCameraTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
  assert.equal(await field.inputValue(),'MANUAL-KEEP','Cancellation preserves manual input');
  const calls=await page.evaluate(()=>{Object.assign(window.whmCameraTest,{mode:'blank',delay:700});return window.whmCameraTest.calls;});
  await trigger.click();await page.waitForFunction(calls=>window.whmCameraTest.calls>calls,calls);
  await page.getByRole('button',{name:'Закрыть сканер',exact:true}).click();
  await page.waitForTimeout(900);
  assert.ok(await page.evaluate(()=>window.whmCameraTest.streams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))),'A late permission response cannot leave the camera running');
  await page.setViewportSize({width:1280,height:900});
}
