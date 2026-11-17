export interface TimetableTrain {
  id: string; name: string; days: string[];
  stops: { station: string; arrival: string | null; departure: string | null }[];
}
export interface TrainOption { id: string; name: string; departure: string; arrival: string | null; arrivalDay: number; }
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function minutes(time: string | null): number | null {
  const match = time?.match(/^(\d{1,2}):(\d{2})\s*(am|pm)(?:\s+BST)?$/i);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return (hour % 12 + (match[3]!.toLowerCase() === 'pm' ? 12 : 0)) * 60 + minute;
}
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function probableTrains(trains: TimetableTrain[], origin: string, destination: string, date: string): TrainOption[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || origin === destination) return [];
  const weekday = new Date(`${date}T12:00:00+06:00`).getUTCDay();
  if (!Number.isFinite(weekday)) return [];
  const options: TrainOption[] = [];
  for (const train of trains) {
    const from = train.stops.findIndex(s => s.station === origin);
    const to = train.stops.findIndex(s => s.station === destination);
    if (from < 0 || to <= from) continue;
    // Reconstruct midnight crossings. Reject inconsistent backward timetable jumps.
    let previous: number | null = null, day = 0, boardingDay = 0, destinationDay = 0, valid = true;
    for (let i = 0; i <= to; i++) {
      const stop = train.stops[i]!;
      for (const time of [stop.arrival, stop.departure]) {
        const value = minutes(time); if (value === null) continue;
        if (previous !== null && value < previous) {
          if (previous >= 18 * 60 && value <= 6 * 60) day++;
          else { valid = false; break; }
        }
        previous = value;
        if (i === to && time === stop.arrival) destinationDay = day;
      }
      if (!valid) break;
      if (i === from) boardingDay = day;
    }
    const departure = minutes(train.stops[from]!.departure), arrival = minutes(train.stops[to]!.arrival);
    if (!valid || departure === null || !train.days.includes(weekdays[((weekday - boardingDay) % 7 + 7) % 7]!)) continue;
    options.push({ id: train.id, name: train.name, departure: clock(departure), arrival: arrival === null ? null : clock(arrival), arrivalDay: destinationDay - boardingDay });
  }
  return options.sort((a,b) => a.departure.localeCompare(b.departure) || a.name.localeCompare(b.name));
}
