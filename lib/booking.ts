import { STATIONS } from './stations.ts';
export type BookingStatus = 'scheduled' | 'opened' | 'missed' | 'cancelled' | 'failed';
export interface BookingInput {
  origin: string; destination: string; travelDate: string; departureTime: string;
  train: string; passengers: number; firstClass: string; secondClass: string;
  seats: string[]; bookingStart: string; allowAlternates: boolean; alternateMinutes: number;
}
export interface Booking extends BookingInput {
  id: string; status: BookingStatus; createdAt: number; note?: string;
}
export const CLASSES = ['S_CHAIR', 'SNIGDHA', 'AC_S', 'AC_B', 'F_SEAT', 'F_BERTH', 'F_CHAIR', 'AC_CHAIR', 'SHOVAN', 'SHULOV'];
export function dhakaTime(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  const timestamp = Date.parse(`${value}:00+06:00`);
  // Date.parse normalizes some invalid dates (for example February 30).
  if (!Number.isFinite(timestamp) || new Date(timestamp + 6 * 3600000).toISOString().slice(0, 16) !== value) return NaN;
  return timestamp;
}
export function validate(input: BookingInput, now = Date.now()): string[] {
  const errors: string[] = [];
  if (!input.origin.trim() || !input.destination.trim() || input.origin.trim().toLowerCase() === input.destination.trim().toLowerCase()) errors.push('Choose different departure and destination stations.');
  if (!STATIONS.some(s => s.name === input.origin && s.origin) || !STATIONS.some(s => s.name === input.destination)) errors.push('Select departure and destination stations from the dropdowns.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.travelDate) || !/^\d{2}:\d{2}$/.test(input.departureTime) || !Number.isFinite(dhakaTime(`${input.travelDate}T${input.departureTime}`))) errors.push('Enter a valid travel date and departure time.');
  if (!input.train.trim()) errors.push('Enter the train name or number from the official search.');
  if (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > 4) errors.push('This version supports 1–4 passengers; the site must confirm its current limit.');
  if (!CLASSES.includes(input.firstClass) || !CLASSES.includes(input.secondClass) || input.firstClass === input.secondClass) errors.push('Choose two different preferred classes.');
  if (input.seats.length !== 5 || input.seats.some(s => !s.trim() || s.length > 30) || new Set(input.seats.map(s => s.trim().toLowerCase())).size !== 5) errors.push('Enter five different individual seat numbers.');
  const start = dhakaTime(input.bookingStart);
  if (!Number.isFinite(start) || start <= now) errors.push('Booking start must be in the future (Bangladesh time).');
  if (start >= dhakaTime(`${input.travelDate}T${input.departureTime}`)) errors.push('Booking must start before the train departs.');
  if (input.allowAlternates && (!Number.isInteger(input.alternateMinutes) || input.alternateMinutes < 1 || input.alternateMinutes > 720)) errors.push('Choose an alternate train window from 1–720 minutes.');
  return errors;
}
export const MAX_LATE_MS = 2 * 60 * 1000;
export function dueStatus(start: number, now: number): 'scheduled' | 'opened' | 'missed' {
  return now < start ? 'scheduled' : now - start > MAX_LATE_MS ? 'missed' : 'opened';
}
