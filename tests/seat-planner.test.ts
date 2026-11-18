import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSeatGroup, type Seat } from '../lib/seat-planner.ts';
// Observed SCHA arrangement: 7/6 on one side of the aisle, 5/4 on the other.
const layout: Seat[] = [
  { id:'SCHA-7',coach:'SCHA',block:'left',row:1,column:0,available:true },
  { id:'SCHA-6',coach:'SCHA',block:'left',row:1,column:1,available:true },
  { id:'SCHA-11',coach:'SCHA',block:'left',row:2,column:0,available:true },
  { id:'SCHA-10',coach:'SCHA',block:'left',row:2,column:1,available:true },
  { id:'SCHA-5',coach:'SCHA',block:'right',row:1,column:3,available:true },
  { id:'SCHA-4',coach:'SCHA',block:'right',row:1,column:4,available:true },
  { id:'SCHA-9',coach:'SCHA',block:'right',row:2,column:3,available:true },
  { id:'SCHA-8',coach:'SCHA',block:'right',row:2,column:4,available:true },
];
test('a preferred seat gets a neighboring group without relying on numeric sequence', () => {
  assert.deepEqual(planSeatGroup(layout,2,['SCHA-6'])?.seats.map(s=>s.id), ['SCHA-7','SCHA-6']);
});
test('unavailable preferred seats become proximity anchors for a nearby group', () => {
  const seats = layout.map(s=>({...s,available:s.id !== 'SCHA-6' && s.id !== 'SCHA-7'}));
  assert.deepEqual(planSeatGroup(seats,2,['SCHA-6'])?.seats.map(s=>s.id), ['SCHA-11','SCHA-10']);
});
test('four passengers get a connected group within two rows in one section', () => {
  const group=planSeatGroup(layout,4,['SCHA-6']);
  assert.equal(group?.seats.length,4); assert.ok(group?.seats.every(s=>s.block==='left'));
});
test('do not split across aisle, coaches or nonadjacent rows', () => {
  assert.equal(planSeatGroup([layout[0]!,layout[4]!],2,[]),null);
  assert.equal(planSeatGroup([layout[0]!,{...layout[1]!,coach:'OTHER'}],2,[]),null);
  assert.equal(planSeatGroup([layout[0]!,{...layout[2]!,row:4}],2,[]),null);
});
test('rank preferred matches before nearby fallback and respect ranked preference ties', () => {
  assert.deepEqual(planSeatGroup(layout,2,['SCHA-4','SCHA-6'])?.seats.map(s=>s.id),['SCHA-5','SCHA-4']);
});
test('fail closed on invalid maps, duplicate identifiers and insufficient seats', () => {
  assert.equal(planSeatGroup([...layout,layout[0]!],2,[]),null);
  assert.equal(planSeatGroup([{...layout[0]!,row:NaN}],1,[]),null);
  assert.equal(planSeatGroup(layout,5,[]),null);
  assert.equal(planSeatGroup(layout.map(s=>({...s,available:false})),1,[]),null);
});
