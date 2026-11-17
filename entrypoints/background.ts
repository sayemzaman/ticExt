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
    row.note = status === 'missed' ? 'Start missed by more than two minutes. Reschedule this request.' : 'Official search opened with your route, date and first class choice. The site may require login. Automatic train and seat selection are not connected yet; payment remains manual.';
    await save(rows); // Claim before opening: a restart must not open duplicate booking tabs.
    if (status === 'opened') {
      try { await chrome.tabs.create({ url: railwaySearchUrl(row) }); }
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
