/** Geometry supplied by a verified seat-map adapter, never inferred from seat numbers. */
export interface Seat {
  id: string;
  coach: string;
  block: string; // one continuous section, separated from other sections by an aisle/partition
  row: number;
  column: number;
  available: boolean;
}
export interface SeatGroup { seats: Seat[]; preferredMatches: number; distance: number; }
const normalized = (name: string) => name.trim().toUpperCase();
const matches = (seat: Seat, preference: string) => normalized(seat.id) === normalized(preference);
function adjacent(a: Seat, b: Seat): boolean {
  return a.coach === b.coach && a.block === b.block && Math.abs(a.row - b.row) + Math.abs(a.column - b.column) === 1;
}
/** Same coach/block, connected seats, at most two adjacent rows. No split groups. */
export function planSeatGroup(layout: Seat[], count: number, preferred: string[]): SeatGroup | null {
  if (!Number.isInteger(count) || count < 1 || count > 4) return null;
  if (layout.some(s => !s.id || !s.coach || !s.block || !Number.isInteger(s.row) || !Number.isInteger(s.column))) return null;
  const keys = layout.map(s => `${s.coach}:${s.id}`);
  if (new Set(keys).size !== keys.length) return null;
  const positions = layout.map(s => `${s.coach}:${s.block}:${s.row}:${s.column}`);
  if (new Set(positions).size !== positions.length) return null;
  const available = layout.filter(s => s.available);
  const anchors = layout.filter(s => preferred.some(p => matches(s, p)));
  let best: SeatGroup | null = null;
  let bestRank: number[] | undefined;
  const seen = new Set<string>();
  function consider(group: Seat[]) {
    const hits: number[] = preferred.map(p => group.some(s => matches(s, p)) ? 1 : 0);
    // A preference in another coach has no measurable geometric distance.
    const sameCoach = anchors.filter(a => a.coach === group[0]!.coach);
    const distance = sameCoach.length ? Math.min(...sameCoach.map(a => Math.min(...group.map(s => Math.abs(a.row - s.row) + Math.abs(a.column - s.column))))) : Infinity;
    // First include preferred seats; then honor preference order; then proximity.
    const rank = [-hits.reduce((a,b) => a+b, 0), ...hits.map(v => -v), distance];
    if (!bestRank || rank.some((v,i) => v < bestRank![i]! && rank.slice(0,i).every((x,j) => x === bestRank![j]))) {
      bestRank = rank; best = { seats: [...group].sort((a,b) => a.row-b.row || a.column-b.column), preferredMatches: hits.reduce((a,b)=>a+b,0), distance };
    }
  }
  function grow(indices: number[]) {
    const key = [...indices].sort((a,b)=>a-b).join(','); if (seen.has(key)) return; seen.add(key);
    const group = indices.map(i => available[i]!);
    if (group.length === count) { consider(group); return; }
    for (let i = 0; i < available.length; i++) {
      const seat = available[i]!;
      if (indices.includes(i) || !group.some(s => adjacent(s, seat))) continue;
      const rows = [...group.map(s=>s.row), seat.row];
      if (Math.max(...rows) - Math.min(...rows) > 1) continue;
      grow([...indices,i]);
    }
  }
  for (let i=0;i<available.length;i++) grow([i]);
  return best;
}
