import type { Booking } from '../lib/booking';
import { candidateTrains, prepareLayout, waitFor } from '../lib/railway-dom';
import { railwaySearchUrl } from '../lib/railway';
export default defineContentScript({
  matches:['https://eticket.railway.gov.bd/*'],
  runAt:'document_idle',
  async main() {
    const booking = await chrome.runtime.sendMessage({type:'assistant-context'}) as Booking | null;
    if (!booking) return; // Ordinary railway tabs are never acted on.
    const panel=document.createElement('aside');
    panel.style.cssText='position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#fff;border:2px solid #1976d2;border-radius:12px;padding:18px;max-width:340px;box-shadow:0 4px 20px #0003;color:#183c30;font:14px/1.6 sans-serif';
    panel.setAttribute('aria-live','polite'); document.body.append(panel);
    panel.textContent='ticExt: preparing a seat recommendation. No seats will be selected or reserved.';
    async function report(status:'layout-ready'|'blocked'|'needs-login', recommendation?: Booking['recommendation']) {
      await chrome.runtime.sendMessage({type:'assistant-result',status,recommendation});
    }
    try {
      if (location.pathname.includes('login') || document.querySelector('input[type=password]')) {
        panel.textContent='ticExt needs you to sign in on the railway website. This attempt has stopped. No seats reserved.'; await report('needs-login'); return;
      }
      const expected=new URL(railwaySearchUrl(booking));
      if (location.pathname!==expected.pathname || ['fromcity','tocity','doj'].some(key=>new URL(location.href).searchParams.get(key)!==expected.searchParams.get(key))) throw new Error('Journey does not match the saved request.');
      await waitFor(()=>document.querySelector('app-single-trip'),20000);
      const cards=candidateTrains(document,booking);
      for (const card of cards) for (const travelClass of [booking.firstClass,booking.secondClass]) {
        const result=await prepareLayout(card,booking,travelClass);
        if (result) {
          panel.textContent=`ticExt recommendation: ${result.train} · ${travelClass} · ${result.coach}: ${result.seats.join(', ')}. Blue outlines are suggestions only. No seats reserved. Seat selection and checkout are still manual in this version.`;
          await report('layout-ready',result); return;
        }
      }
      throw new Error('No suitable group found in the allowed trains and classes.');
    } catch {
      panel.textContent='ticExt stopped: login, verification, unavailable seats or a changed layout needs review. No seats were selected. Please use the railway page manually.';
      await report('blocked');
    }
  },
});
