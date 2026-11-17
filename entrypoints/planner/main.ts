import './style.css';
import { CLASSES, validate, dhakaTime, type BookingInput } from '../../lib/booking';
import { getBookings } from '../../lib/storage';
const form = document.querySelector<HTMLFormElement>('#booking-form')!;
const message = document.querySelector<HTMLParagraphElement>('#form-message')!;
let editing: string | undefined;
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
const format = (date: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }).format(date);
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
for (const name of ['firstClass', 'secondClass']) {
  const select = form.elements.namedItem(name) as HTMLSelectElement;
  for (const value of CLASSES) select.add(new Option(value.replaceAll('_', ' '), value));
}
field('secondClass').value = 'SNIGDHA';
for (let i = 0; i < 5; i++) {
  const label = el('label', `#${i + 1}`); const input = document.createElement('input');
  input.name = `seat${i}`; input.required = true; input.maxLength = 30; input.placeholder = 'Seat no.'; label.append(input);
  document.querySelector('#seat-inputs')!.append(label);
}
field('allowAlternates').addEventListener('change', () => { document.querySelector<HTMLElement>('#alternate-window')!.hidden = !field('allowAlternates').checked; });
document.querySelector('#search-site')!.addEventListener('click', () => { void chrome.tabs.create({ url: 'https://eticket.railway.gov.bd/' }); });
function reset() { editing = undefined; form.reset(); field('secondClass').value = 'SNIGDHA'; document.querySelector<HTMLElement>('#alternate-window')!.hidden = true; document.querySelector('#submit')!.textContent = 'Schedule start →'; message.textContent = ''; }
document.querySelector('#clear-form')!.addEventListener('click', reset);
form.addEventListener('submit', async event => {
  event.preventDefault();
  const input: BookingInput = {
    origin: field('origin').value.trim(), destination: field('destination').value.trim(), travelDate: field('travelDate').value,
    departureTime: field('departureTime').value, train: field('train').value.trim(), passengers: Number(field('passengers').value),
    firstClass: field('firstClass').value, secondClass: field('secondClass').value, seats: Array.from({ length: 5 }, (_, i) => field(`seat${i}`).value.trim()),
    bookingStart: field('bookingStart').value, allowAlternates: field('allowAlternates').checked, alternateMinutes: Number(field('alternateMinutes').value),
  };
  message.className = ''; const errors = validate(input); if (errors.length) { message.textContent = errors.join(' '); return; }
  const button = document.querySelector<HTMLButtonElement>('#submit')!; button.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'save', input, id: editing });
    if (!result?.ok) throw new Error(result?.error ?? 'Could not save.');
    reset(); message.className = 'success'; message.textContent = 'Start scheduled. Automatic seat selection is not available in this version.'; await render();
  } catch (error) { message.textContent = String(error instanceof Error ? error.message : error); }
  finally { button.disabled = false; }
});
async function render() {
  const rows = (await getBookings()).sort((a, b) => dhakaTime(a.bookingStart) - dhakaTime(b.bookingStart));
  const container = document.querySelector('#plans')!; container.replaceChildren(); document.querySelector('#plan-count')!.textContent = String(rows.length);
  if (!rows.length) { const empty = el('div', '', 'empty'); empty.append(el('strong', 'A journey starts with a plan.'), document.createTextNode('Your scheduled journeys will appear here.')); container.append(empty); }
  for (const row of rows) {
    const card = el('article', '', 'plan'); card.append(el('span', row.status, 'status'), el('h3', `${row.origin} → ${row.destination}`),
      el('p', `${row.train} · ${row.travelDate} at ${row.departureTime}\n${row.passengers} passenger(s) · ${row.firstClass} → ${row.secondClass}`),
      el('p', `Preferred seats: ${row.seats.join(', ')} · Stay together`),
      el('p', row.allowAlternates ? `Alternate trains within ${row.alternateMinutes} minutes allowed.` : 'Selected train only.'),
      el('p', `Booking starts ${format(dhakaTime(row.bookingStart))} (BD)`));
    if (row.status === 'scheduled') {
      const remaining = Math.max(0, Math.ceil((dhakaTime(row.bookingStart) - Date.now()) / 60000)); card.append(el('p', remaining ? `Starts in ${remaining} minutes` : 'Start is due. Checking browser alarm…'));
      const cancel = el('button', 'Cancel', 'secondary'); cancel.type = 'button'; cancel.onclick = async () => {
        try { const result = await chrome.runtime.sendMessage({ type: 'cancel', id: row.id }); if (!result?.ok) throw new Error(result?.error); await render(); }
        catch { message.textContent = 'Could not cancel. Please try again.'; }
      }; card.append(cancel);
    }
    if (row.status !== 'opened') {
      const edit = el('button', row.status === 'scheduled' ? 'Edit' : 'Reschedule', 'secondary'); edit.type = 'button'; edit.onclick = () => {
        editing = row.id; for (const [key, value] of Object.entries(row)) {
          const item = form.elements.namedItem(key) as HTMLInputElement | null;
          if (item) { if (item.type === 'checkbox') item.checked = Boolean(value); else item.value = String(value); }
        }
        row.seats.forEach((seat, i) => { field(`seat${i}`).value = seat; });
        document.querySelector<HTMLElement>('#alternate-window')!.hidden = !row.allowAlternates;
        document.querySelector('#submit')!.textContent = 'Save changes →'; form.scrollIntoView({ behavior: 'smooth' }); field('origin').focus();
      }; card.append(edit);
    }
    if (row.note) card.append(el('p', row.note)); container.append(card);
  }
}
chrome.storage.onChanged.addListener(() => { void render(); });
setInterval(() => { if (!document.hidden) void render(); }, 30000);
void render().catch(() => { message.textContent = 'Could not load saved plans. Reopen ticExt to retry.'; });

