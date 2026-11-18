import './style.css';
import { CLASSES, validate, dhakaTime, type BookingInput } from '../../lib/booking';
import { getBookings } from '../../lib/storage';
import { STATIONS } from '../../lib/stations';
import timetable from '../../lib/timetable-data.json';
import { probableTrains, type TrainOption } from '../../lib/timetable';
import { railwaySearchUrl } from '../../lib/railway';
const form = document.querySelector<HTMLFormElement>('#booking-form')!;
const message = document.querySelector<HTMLParagraphElement>('#form-message')!;
let editing: string | undefined;
const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
const format = (date: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }).format(date);
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className = '') {
  const node = document.createElement(tag); node.textContent = text; node.className = className; return node;
}
for (const name of ['origin', 'destination']) {
  const select = form.elements.namedItem(name) as HTMLSelectElement;
  for (const station of STATIONS) {
    if (name === 'destination' || station.origin) select.add(new Option(station.name, station.name));
  }
}
for (const name of ['firstClass', 'secondClass']) {
  const select = form.elements.namedItem(name) as HTMLSelectElement;
  for (const value of CLASSES) select.add(new Option(value.replaceAll('_', ' '), value));
}
field('secondClass').value = 'SNIGDHA';
const trainChoice = form.elements.namedItem('trainChoice') as HTMLSelectElement;
let trains: TrainOption[] = [];
function manualMode() {
  const manual = field('manualTrain').checked;
  trainChoice.disabled = manual || !trains.length; trainChoice.required = !manual;
  field('train').readOnly = !manual; field('departureTime').readOnly = !manual;
}
function showTrains(preserve = false) {
  const oldTrain = field('train').value, oldTime = field('departureTime').value;
  trains = probableTrains(timetable.trains, field('origin').value, field('destination').value, field('travelDate').value);
  trainChoice.replaceChildren(new Option(trains.length ? 'Choose your preferred departure' : 'No probable trains to show', ''));
  for (const train of trains) trainChoice.add(new Option(`${train.departure} · ${train.name}${train.arrival ? ` → ${train.arrival}${train.arrivalDay ? ` (+${train.arrivalDay} day)` : ''}` : ''}`, train.id));
  const previous = preserve ? trains.find(t => t.name === oldTrain && t.departure === oldTime) : undefined;
  if (previous) trainChoice.value = previous.id;
  else if (!preserve) { field('train').value = ''; field('departureTime').value = ''; }
  if (preserve) field('manualTrain').checked = !previous && Boolean(oldTrain);
  const complete = field('origin').value && field('destination').value && field('travelDate').value;
  document.querySelector('#timetable-status')!.textContent = !complete ? 'Choose departure, destination and travel date to see probable trains.' : `${trains.length ? `${trains.length} probable train(s).` : 'No matching timetable in this snapshot. This does not confirm there are no services.'} Snapshot: ${timetable.capturedAt.slice(0, 10)}. Check the official site for current service.`;
  manualMode();
}
for (const name of ['origin', 'destination', 'travelDate']) field(name).addEventListener('change', () => showTrains());
trainChoice.addEventListener('change', () => {
  const train = trains.find(t => t.id === trainChoice.value);
  field('train').value = train?.name ?? ''; field('departureTime').value = train?.departure ?? '';
});
field('manualTrain').addEventListener('change', () => { field('train').value = ''; field('departureTime').value = ''; trainChoice.value = ''; manualMode(); });
showTrains();
for (let i = 0; i < 5; i++) {
  const label = el('label', `#${i + 1}`); const input = document.createElement('input');
  input.name = `seat${i}`; input.required = true; input.maxLength = 30; input.placeholder = 'Seat no.'; label.append(input);
  document.querySelector('#seat-inputs')!.append(label);
}
field('allowAlternates').addEventListener('change', () => { document.querySelector<HTMLElement>('#alternate-window')!.hidden = !field('allowAlternates').checked; });
document.querySelector('#search-site')!.addEventListener('click', () => {
  const hasJourney = field('origin').value && field('destination').value && field('travelDate').value;
  void chrome.tabs.create({ url: hasJourney ? railwaySearchUrl({ origin: field('origin').value, destination: field('destination').value, travelDate: field('travelDate').value, firstClass: field('firstClass').value }) : 'https://eticket.railway.gov.bd/' });
});
function reset() { editing = undefined; form.reset(); field('secondClass').value = 'SNIGDHA'; showTrains(); document.querySelector<HTMLElement>('#alternate-window')!.hidden = true; document.querySelector('#submit')!.textContent = 'Schedule start →'; message.textContent = ''; }
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
        showTrains(true);
        document.querySelector<HTMLElement>('#alternate-window')!.hidden = !row.allowAlternates;
        document.querySelector('#submit')!.textContent = 'Save changes →'; form.scrollIntoView({ behavior: 'smooth' }); field('origin').focus();
      }; card.append(edit);
    }
    if (row.note) card.append(el('p', row.note)); container.append(card);
    if (row.recommendation) card.append(el('p', `Suggested: ${row.recommendation.train} · ${row.recommendation.travelClass} · ${row.recommendation.seats.join(', ')}. Not reserved.`));
  }
}
chrome.storage.onChanged.addListener(() => { void render(); });
setInterval(() => { if (!document.hidden) void render(); }, 30000);
void render().catch(() => { message.textContent = 'Could not load saved plans. Reopen ticExt to retry.'; });

