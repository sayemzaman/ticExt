import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const fixture=await fs.readFile('tests/fixtures/railway.html','utf8');
let responseBody=fixture;
const extension=resolve('.output/chrome-mv3');
const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
try {
 await context.route('https://eticket.railway.gov.bd/**',route=>route.fulfill({body:responseBody,contentType:'text/html'}));
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const url='https://eticket.railway.gov.bd/booking/train/search?fromcity=Dhaka&tocity=Chattogram&doj=28-Nov-2026&class=S_CHAIR';
 const normal=await context.newPage();await normal.goto(url);
 assert.equal(await normal.locator('app-seat-layout').count(),0,'Normal tabs must not be acted on');
 async function attempt(overrides={}) {
   const pagePromise=context.waitForEvent('page');
   const tabId=await worker.evaluate(async()=> (await chrome.tabs.create({url:'about:blank'})).id);
   const page=await pagePromise;
   await worker.evaluate(async({tabId,overrides})=>{
     await chrome.storage.local.set({bookings:[{id:crypto.randomUUID(),status:'opened',assistantStatus:'preparing',tabId,createdAt:Date.now(),origin:'Dhaka',destination:'Chattogram',travelDate:'2026-11-28',departureTime:'09:00',train:'TEST EXPRESS (123)',passengers:2,firstClass:'S_CHAIR',secondClass:'SNIGDHA',seats:['SCHA-6','SCHA-7','SCHA-10','SCHA-11','SCHA-4'],bookingStart:'2026-11-19T09:00',allowAlternates:false,alternateMinutes:120,...overrides}]});
   },{tabId,overrides});
   await worker.evaluate(async({tabId,url})=>{await chrome.tabs.update(tabId,{url})},{tabId,url});
   await page.waitForURL(url);
   await page.waitForFunction(()=>/ticExt recommendation:|ticExt stopped:|ticExt needs/.test(document.querySelector('aside')?.textContent??''),{},{timeout:25000});
   let booking;
   for(let i=0;i<40;i++) {
     booking=await worker.evaluate(async()=> (await chrome.storage.local.get('bookings')).bookings[0]);
     if(booking.assistantStatus!=='preparing')break;
     await page.waitForTimeout(50);
   }
   assert.equal(await page.evaluate(()=>window.seatClicks),0);
   assert.equal(await page.evaluate(()=>window.purchaseClicks),0);
   return {page,booking};
 }
 const {page,booking}=await attempt();
 assert.equal(booking.assistantStatus,'layout-ready');
 assert.equal(booking.recommendation.travelClass,'SNIGDHA');
 assert.deepEqual(booking.recommendation.seats,['SCHA-7','SCHA-6']);
 assert.ok((await page.evaluate(()=>window.coaches)).includes('UMA'));
 assert.equal(await page.locator('#select-bogie').inputValue(),'1');
 assert.equal(await page.locator('.btn-seat').evaluateAll(bs=>bs.filter(b=>b.style.outline).length),2);
 await page.reload();await page.waitForTimeout(300);
 assert.equal(await page.locator('app-seat-layout').count(),0,'Completed previews must not rerun on reload');
 const unavailable=await attempt({train:'MISSING TRAIN (999)'});
 assert.equal(unavailable.booking.assistantStatus,'blocked');
 const alternate=await attempt({train:'MISSING TRAIN (999)',allowAlternates:true});
 assert.equal(alternate.booking.assistantStatus,'layout-ready');
 assert.equal(alternate.booking.recommendation.train,'TEST EXPRESS (123)');
 const tooFar=await attempt({train:'MISSING TRAIN (999)',departureTime:'12:00',allowAlternates:true,alternateMinutes:30});
 assert.equal(tooFar.booking.assistantStatus,'blocked');
 responseBody=fixture.replaceAll('class="seat-in-row"','class="unknown-geometry"');
 const changed=await attempt();assert.equal(changed.booking.assistantStatus,'blocked');
 responseBody='<html><body><input type="password"><script>window.seatClicks=0;window.purchaseClicks=0;</script></body></html>';
 const login=await attempt();assert.equal(login.booking.assistantStatus,'needs-login');
 console.log('PASS: tab-bound assistant, class fallback, coach scanning, seat recommendation, alternate train rules, no seat or checkout clicks.');
}finally{await context.close();}
