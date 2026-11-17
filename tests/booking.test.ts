import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, dhakaTime, dueStatus, type BookingInput } from '../lib/booking.ts';
const now = Date.parse('2030-01-01T00:00:00Z');
const input: BookingInput = { origin: 'Dhaka', destination: 'Chattogram', travelDate: '2030-01-10', departureTime: '09:00', train: 'Example train', passengers: 2, firstClass: 'S_CHAIR', secondClass: 'SNIGDHA', seats: ['A1','A2','A3','A4','A5'], bookingStart: '2030-01-02T08:00', allowAlternates: true, alternateMinutes: 120 };
test('accept a complete request and interpret time in Dhaka independently of host timezone', () => {
  assert.deepEqual(validate(input, now), []);
  assert.equal(dhakaTime(input.bookingStart), Date.parse('2030-01-02T02:00:00Z'));
});
test('reject duplicate seats and classes, invalid route, counts and late booking', () => {
  for (const patch of [{ seats: ['a1','A1','A3','A4','A5'] }, { secondClass: 'S_CHAIR' }, { destination: ' dhaka ' }, { passengers: 0 }, { passengers: 2.5 }, { bookingStart: '2030-01-10T10:00' }, { bookingStart: '2020-01-01T10:00' }, { alternateMinutes: 0 }]) assert.ok(validate({ ...input, ...patch }, now).length);
});
test('late-start policy prevents stale booking attempts after sleep', () => {
  const start = dhakaTime(input.bookingStart);
  assert.equal(dueStatus(start, start - 1), 'scheduled');
  assert.equal(dueStatus(start, start + 120000), 'opened');
  assert.equal(dueStatus(start, start + 120001), 'missed');
});
test('reject normalized invalid calendar dates', () => {
  assert.ok(Number.isNaN(dhakaTime('2030-02-30T08:00')));
  assert.ok(validate({ ...input, travelDate: '2030-02-30' }, now).length);
});
