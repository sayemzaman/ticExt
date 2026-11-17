import type { BookingInput } from './booking';
export function railwaySearchUrl(booking: Pick<BookingInput, 'origin' | 'destination' | 'travelDate' | 'firstClass'>): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [year, month, day] = booking.travelDate.split('-');
  const params = new URLSearchParams({ fromcity: booking.origin, tocity: booking.destination, doj: `${day}-${months[Number(month)-1]}-${year}`, class: booking.firstClass });
  return `https://eticket.railway.gov.bd/booking/train/search?${params}`;
}
