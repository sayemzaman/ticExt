// Run manually, never during normal extension use. Reads public timetable data only.
import fs from 'node:fs/promises';
const base = 'https://railspaapi.shohoz.com/v1.0/web';
async function read(path, body) {
  const response = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Timetable request failed (${response.status})`);
  return (await response.json()).data;
}
const handshake = await read('/handshake', { hash: '', eticket: true, shohoz: false, trainBkash: false, trainNagad: false });
const capturedAt = new Date().toISOString();
const date = new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 10);
const trains = []; const missing = [];
for (const [index, train] of handshake.train_names.entries()) {
  try {
    const data = await read('/train-routes', { model: train.model, departure_date_time: date });
    if (!Array.isArray(data?.routes) || !Array.isArray(data?.days) || !data.routes.length) throw new Error('No timetable');
    trains.push({ id: train.model, name: train.name, days: data.days, stops: data.routes.map(s => ({ station: s.city, arrival: s.arrival_time ?? null, departure: s.departure_time ?? null })) });
  } catch { missing.push(train.model); }
  if ((index + 1) % 20 === 0) console.log(`${index + 1}/${handshake.train_names.length} checked`);
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!trains.length) throw new Error('No timetables retrieved; previous snapshot preserved');
await fs.writeFile('lib/timetable-data.json', JSON.stringify({ capturedAt, source: 'https://eticket.railway.gov.bd/train-information', missing, trains }, null, 2) + '\n');
console.log(`Saved ${trains.length} timetables; ${missing.length} unavailable.`);
