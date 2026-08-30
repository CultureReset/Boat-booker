/**
 * Date helpers.
 *
 * Trip dates are plain `YYYY-MM-DD` strings with no timezone attached — a trip
 * on the 4th is on the 4th wherever the guest happens to be browsing from.
 * Timestamps (created, confirmed) are full ISO strings in UTC.
 */

export type IsoDate = string;

const MS_PER_DAY = 86_400_000;

export function toIsoDate(input: Date | string): IsoDate {
  if (typeof input === 'string') return input.slice(0, 10);
  return input.toISOString().slice(0, 10);
}

export function parseIsoDate(date: IsoDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(parseIsoDate(date).getTime() + days * MS_PER_DAY));
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isPast(date: IsoDate): boolean {
  return date < today();
}

/** Monday = 1 … Sunday = 7, matching the weekday bitmask convention. */
export function isoWeekday(date: IsoDate): number {
  const day = parseIsoDate(date).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Weekday bitmask test. Bit 0 is Monday, so every day is 127. */
export function weekdayMaskAllows(mask: number, date: IsoDate): boolean {
  return (mask & (1 << (isoWeekday(date) - 1))) !== 0;
}

export const WEEKDAY_MASK_ALL = 127;

export function maskFromWeekdays(days: number[]): number {
  return days.reduce((mask, day) => mask | (1 << (day - 1)), 0);
}

export function weekdaysFromMask(mask: number): number[] {
  return [1, 2, 3, 4, 5, 6, 7].filter((d) => (mask & (1 << (d - 1))) !== 0);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDate(date: IsoDate, style: 'short' | 'medium' | 'long' = 'medium'): string {
  const d = parseIsoDate(date);
  const month = MONTHS[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  if (style === 'short') return `${month.slice(0, 3)} ${day}`;
  if (style === 'long') return `${WEEKDAYS[d.getUTCDay()]}, ${month} ${day}, ${year}`;
  return `${month} ${day}, ${year}`;
}

/** `08:00` -> `8:00 AM`. Times are local to the listing's marina. */
export function formatTime(time: string): string {
  const [hRaw, m = '00'] = time.split(':');
  const h = Number(hRaw);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${suffix}`;
}

export function formatDuration(hours: number): { count: number; unit: 'hour' | 'day' } {
  return hours >= 24 ? { count: Math.round(hours / 24), unit: 'day' } : { count: hours, unit: 'hour' };
}

/** Coarse "3 hours ago" / "2 days ago" for activity feeds. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? 'month' : 'months'}`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

/**
 * Calendar grid for a month, padded to whole weeks.
 *
 * `weekStart` matters: the operator app starts the week on Sunday, which is
 * what US operators expect, while the guest-facing pickers start on Monday.
 * Hardcoding either one puts half the product's calendars a day out.
 */
export function monthGrid(
  year: number,
  month: number,
  weekStart: 'monday' | 'sunday' = 'monday',
): (IsoDate | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const leading =
    weekStart === 'sunday' ? first.getUTCDay() : (first.getUTCDay() + 6) % 7;

  const cells: (IsoDate | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(toIsoDate(new Date(Date.UTC(year, month, d))));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/** Column headers matching a `monthGrid` week start. */
export function weekdayHeadings(weekStart: 'monday' | 'sunday' = 'monday'): string[] {
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekStart === 'sunday' ? short : [...short.slice(1), short[0]];
}
