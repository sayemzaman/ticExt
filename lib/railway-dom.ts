import type { BookingInput } from './booking';
import { planSeatGroup, type Seat } from './seat-planner';

const text = (node: Element | null) => (node?.textContent ?? '').trim().replace(/\s+/g,' ');
const norm = (value: string) => value.trim().toUpperCase().replace(/\s+/g,' ');
export const visible = (node: HTMLElement) => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0 && getComputedStyle(node).visibility !== 'hidden';
export async function waitFor<T>(read: () => T | null | undefined | false, timeout = 12000): Promise<T> {
  const end = Date.now() + timeout;
  do { const result = read(); if (result) return result; await new Promise(r=>setTimeout(r,200)); } while (Date.now() < end);
  throw new Error('The railway page did not reach the expected state.');
}
function departure(card: Element): string | null {
  const match = text(card.querySelector('.journey-start .journey-date')).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  const hour = Number(match[1]); if (hour < 1 || hour > 12 || Number(match[2]) > 59) return null;
  return `${String(hour % 12 + (match[3]!.toUpperCase() === 'PM' ? 12 : 0)).padStart(2,'0')}:${match[2]}`;
}
export function candidateTrains(root: ParentNode, booking: BookingInput): HTMLElement[] {
  const cards = Array.from(root.querySelectorAll<HTMLElement>('app-single-trip'));
  const title = (card: Element) => norm(text(card.querySelector('.trip-name h2, .trip-name h3, .trip-name h4')) || text(card.querySelector('.trip-left-info')?.firstElementChild ?? null));
  const exact = cards.filter(card => title(card) === norm(booking.train) && departure(card) === booking.departureTime);
  if (exact.length > 1) throw new Error('Ambiguous train match.');
  if (!booking.allowAlternates) return exact;
  const minute = (s: string) => Number(s.slice(0,2))*60+Number(s.slice(3));
  const difference = (card: Element) => { const time = departure(card); return time ? Math.abs(minute(time)-minute(booking.departureTime)) : Infinity; };
  return [...exact,...cards.filter(c=>!exact.includes(c) && difference(c)<=booking.alternateMinutes).sort((a,b)=>difference(a)-difference(b))];
}
export function classButton(card: Element, travelClass: string): HTMLButtonElement | null {
  const choices = Array.from(card.querySelectorAll<HTMLElement>('.single-seat-class')).filter(c => norm(text(c.querySelector('.seat-class-name'))) === norm(travelClass));
  if (choices.length !== 1) return null;
  const button = choices[0]!.querySelector<HTMLButtonElement>('button.book-now-btn');
  return button && !button.disabled && visible(button) ? button : null;
}
/** Preserve empty grid slots and aisle blocks. Unknown or mixed layouts fail closed. */
export function readSeatMap(layout: HTMLElement): Seat[] {
  const select = layout.querySelector<HTMLSelectElement>('#select-bogie');
  const coach = select?.selectedOptions[0]?.textContent?.split(/\s+-\s+/)[0]?.trim();
  if (!coach) throw new Error('Missing coach identity.');
  const floors = Array.from(layout.querySelectorAll<HTMLElement>('.seat_layout')).filter(visible);
  if (floors.length !== 1) throw new Error('Expected one visible floor.');
  const seats: Seat[] = [];
  for (const [rowIndex,row] of Array.from(floors[0]!.querySelectorAll<HTMLElement>('.seat-row')).entries()) {
    const blocks = Array.from(row.querySelectorAll<HTMLElement>(':scope > .seat-in-row'));
    if (blocks.length !== 2) throw new Error('Unrecognized aisle geometry.');
    for (const [blockIndex,block] of blocks.entries()) {
      const wrappers = Array.from(block.querySelectorAll<HTMLElement>(':scope > .seat-wrapper'));
      if (wrappers.length > 3) throw new Error('Unrecognized seat block width.');
      wrappers.forEach((wrapper,column) => {
        const button = wrapper.querySelector<HTMLButtonElement>('button.btn-seat');
        if (!button) throw new Error('Missing seat slot.');
        const id = button.title.trim();
        if (button.classList.contains('seat-hidden') || !id) return;
        if (!id.startsWith(coach + '-')) throw new Error('Coach and seat label mismatch.');
        if (button.classList.contains('seat-selected') || button.classList.contains('request_pending')) throw new Error('Existing seat selection or reservation in progress.');
        seats.push({ id,coach,block:String(blockIndex),row:rowIndex,column:column+blockIndex*4,
          available: !button.disabled && button.classList.contains('seat-available') && !button.matches('.seat-booked,.seat-in-progress,.seat-disabled') });
      });
    }
  }
  if (!seats.length) throw new Error('No readable seats.');
  return seats;
}
export async function prepareLayout(card: HTMLElement, booking: BookingInput, travelClass: string) {
  const button = classButton(card,travelClass); if (!button) return null;
  // BOOK NOW opens a map; only seat buttons create reservations. Never click them here.
  button.click();
  const layout = await waitFor(() => Array.from(card.querySelectorAll<HTMLElement>('app-seat-layout')).find(visible));
  const select = await waitFor(() => layout.querySelector<HTMLSelectElement>('#select-bogie'));
  await waitFor(() => layout.querySelector('.seat-row'));
  const all: Seat[] = [];
  const options = Array.from(select.options).map(o=>({value:o.value,name:(o.textContent??'').split(/\s+-\s+/)[0]?.trim()}));
  if (options.length > 30) throw new Error('Unexpected number of coaches.');
  async function choose(value: string) {
    if (select.value !== value) { select.value = value; select.dispatchEvent(new Event('change',{bubbles:true})); }
    const name = options.find(o=>o.value===value)?.name;
    await waitFor(() => { const buttons = Array.from(layout.querySelectorAll<HTMLButtonElement>('.btn-seat[title]')).filter(b=>b.title && !b.classList.contains('seat-hidden')); return buttons.length && buttons.every(b=>b.title.startsWith(name+'-')) ? true : null; });
    return readSeatMap(layout);
  }
  for (const option of options) all.push(...await choose(option.value));
  const group = planSeatGroup(all,booking.passengers,booking.seats);
  if (!group) { layout.querySelector<HTMLButtonElement>('.btn-close-seat-layout')?.click(); return null; }
  const coach = group.seats[0]!.coach;
  const option = options.find(o=>o.name===coach); if (!option) throw new Error('Coach disappeared.');
  const current = await choose(option.value);
  if (!group.seats.every(s=>current.some(c=>c.id===s.id && c.available))) throw new Error('Seat availability changed.');
  // Outline only: no seat click, no reservation request, no Continue Purchase click.
  for (const seat of group.seats) {
    const target = Array.from(layout.querySelectorAll<HTMLButtonElement>('.btn-seat')).find(b=>b.title===seat.id);
    if (target) { target.style.outline='3px solid #1976d2'; target.style.outlineOffset='3px'; }
  }
  return { coach,seats:group.seats.map(s=>s.id),travelClass,train:text(card.querySelector('.trip-name h2, .trip-name h3, .trip-name h4')) || booking.train };
}
