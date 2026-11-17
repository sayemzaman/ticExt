import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probableTrains, minutes, type TimetableTrain } from '../lib/timetable.ts';
import { railwaySearchUrl } from '../lib/railway.ts';
const train: TimetableTrain = { id: 'test', name: 'Test overnight', days: ['Mon'], stops: [
  { station: 'Dhaka', arrival: null, departure: '11:30 pm BST' },
  { station: 'Intermediate', arrival: '01:00 am BST', departure: '01:05 am BST' },
  { station: 'Chattogram', arrival: '06:00 am BST', departure: null },
] };
test('convert 12-hour timetable clocks', () => {
  assert.equal(minutes('12:00 am BST'), 0); assert.equal(minutes('12:00 pm BST'), 720);
  assert.equal(minutes('09:10 am BST'), 550); assert.equal(minutes('13:00 pm BST'), null);
});
test('filter route direction and day; account for overnight boarding date', () => {
  assert.equal(probableTrains([train], 'Dhaka','Chattogram','2030-01-07')[0]?.arrivalDay, 1); // Monday
  assert.equal(probableTrains([train], 'Dhaka','Chattogram','2030-01-08').length, 0);
  assert.equal(probableTrains([train], 'Intermediate','Chattogram','2030-01-08')[0]?.departure, '01:05');
  assert.equal(probableTrains([train], 'Intermediate','Chattogram','2030-01-07').length, 0);
  assert.equal(probableTrains([train], 'Chattogram','Dhaka','2030-01-07').length, 0);
});
test('do not invent a next-day service from an inconsistent backward jump', () => {
  const invalid = { ...train, stops: [train.stops[0], { station: 'Chattogram', arrival: '07:00 pm BST', departure: null }] };
  assert.equal(probableTrains([invalid], 'Dhaka','Chattogram','2030-01-07').length, 0);
});
test('prepare official search query with railway date format and encoded station names', () => {
  const url = new URL(railwaySearchUrl({ origin: 'Biman_Bandar', destination: 'Chattogram', travelDate: '2030-01-07', firstClass: 'SNIGDHA' }));
  assert.equal(url.origin, 'https://eticket.railway.gov.bd');
  assert.equal(url.searchParams.get('doj'), '07-Jan-2030');
  assert.equal(url.searchParams.get('fromcity'), 'Biman_Bandar');
  assert.equal(url.searchParams.get('class'), 'SNIGDHA');
});
