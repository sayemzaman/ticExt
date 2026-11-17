import type { Booking } from './booking';
export async function getBookings(): Promise<Booking[]> {
  const result = await chrome.storage.local.get('bookings');
  return Array.isArray(result.bookings) ? result.bookings : [];
}
