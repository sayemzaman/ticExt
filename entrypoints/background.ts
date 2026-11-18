import { dhakaTime, dueStatus, validate, type Booking, type BookingInput } from '../lib/booking';
import { getBookings } from '../lib/storage';
import { railwaySearchUrl } from '../lib/railway';

export default defineBackground(() => {
  // Serialize every mutation so an alarm and a form save cannot overwrite one another.
  let queue: Promise<unknown> = Promise.resolve();
  function serial<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work); queue = next.catch(() => {}); return next;
  }
  async function save(rows: Booking[]) { await chrome.storage.local.set({ bookings: rows }); }
  async function run(id: string) {
    const rows = await getBookings(); const row = rows.find(b => b.id === id);
    if (!row || row.status !== 'scheduled') return;
    const status = dueStatus(dhakaTime(row.bookingStart), Date.now());
    if (status === 'scheduled') { await chrome.alarms.create(id, { when: dhakaTime(row.bookingStart) }); return; }
    row.status = status;
    row.note = status === 'missed' ? 'Start missed by more than two minutes. Reschedule this request.' : 'Opening the official search and preparing a seat recommendation. No seats will be reserved in this version.';
    await save(rows); // Claim before opening: a restart must not open duplicate booking tabs.
    if (status === 'opened') {
      try {
        // Bind this run to a single tab before any site content script starts.
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        if (tab.id === undefined) throw new Error('No tab id');
        row.tabId = tab.id; row.assistantStatus = 'preparing'; await save(rows);
        await chrome.tabs.update(tab.id, { url: railwaySearchUrl(row) });
      }
      catch { row.status = 'failed'; row.note = 'Could not open the official site. Reschedule to retry.'; await save(rows); }
    }
  }
  async function restore() {
    for (const row of await getBookings()) if (row.status === 'scheduled') {
      if (dhakaTime(row.bookingStart) <= Date.now()) await run(row.id);
      else await chrome.alarms.create(row.id, { when: dhakaTime(row.bookingStart) });
    }
  }
  chrome.action.onClicked.addListener(() => { void chrome.tabs.create({ url: chrome.runtime.getURL('/planner.html') }); });
  chrome.alarms.onAlarm.addListener(alarm => { void serial(() => run(alarm.name)); });
  chrome.runtime.onStartup.addListener(() => { void serial(restore); });
  chrome.runtime.onInstalled.addListener(() => { void serial(restore); });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    const site = sender.url?.startsWith('https://eticket.railway.gov.bd/');
    if (site && sender.id === chrome.runtime.id && sender.tab?.id !== undefined && sender.frameId === 0) {
      serial(async () => {
        const rows = await getBookings();
        const row = rows.find(b => b.tabId === sender.tab!.id && b.status === 'opened');
        if (!row || !row.assistantStatus) return null;
        if (message.type === 'assistant-context') return row.assistantStatus === 'preparing' ? row : null;
        if (message.type === 'assistant-result' && row.assistantStatus === 'preparing') {
          const statuses = ['layout-ready','needs-login','blocked'];
          if (!statuses.includes(message.status)) return null;
          row.assistantStatus = message.status;
          // Store only controlled summaries, never page text, account data or HTML.
          row.note = message.status === 'layout-ready' ? 'Seat group found. Review the highlighted recommendation on the railway page. No seats reserved.' : message.status === 'needs-login' ? 'Railway login is required. Sign in and create a new attempt; credentials stay on the railway site.' : 'The assistant could not prepare a verified seat group. Check the railway page; no seats were selected.';
          if (message.status === 'layout-ready' && message.recommendation) {
            const rec = message.recommendation;
            if (typeof rec.train !== 'string' || typeof rec.coach !== 'string' || ![row.firstClass,row.secondClass].includes(rec.travelClass) || !Array.isArray(rec.seats) || rec.seats.length !== row.passengers || rec.seats.some((s: unknown) => typeof s !== 'string' || s.length > 50)) return null;
            row.recommendation = { train: rec.train.slice(0,100), travelClass: rec.travelClass, coach: rec.coach.slice(0,50), seats: rec.seats };
          }
          await save(rows); return { ok:true };
        }
        return null;
      }).then(reply, () => reply(null));
      return true;
    }
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('/'))) return;
    serial(async () => {
      const rows = await getBookings();
      if (message.type === 'save') {
        const input = message.input as BookingInput;
        const errors = validate(input); if (errors.length) throw new Error(errors.join(' '));
        const existing = rows.find(b => b.id === message.id);
        if (existing?.status === 'opened') throw new Error('This attempt already opened. Create a new request to try again.');
        const row: Booking = { ...input, id: existing?.id ?? crypto.randomUUID(), status: 'scheduled', createdAt: existing?.createdAt ?? Date.now() };
        await chrome.alarms.create(row.id, { when: dhakaTime(row.bookingStart) });
        await save([...rows.filter(b => b.id !== row.id), row]);
      } else if (message.type === 'cancel') {
        const row = rows.find(b => b.id === message.id);
        if (row?.status === 'scheduled') { await chrome.alarms.clear(row.id); row.status = 'cancelled'; await save(rows); }
      } else throw new Error('Unknown action.');
      return { ok: true };
    }).then(reply, error => reply({ ok: false, error: String(error.message ?? error) }));
    return true;
  });
  void serial(restore);
});
