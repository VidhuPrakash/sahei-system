export const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface BusinessHourRow {
  dayOfWeek: number;
  openTime: number;
  closeTime: number;
}

export function defaultBusinessHours(): BusinessHourRow[] {
  return DAY_LABELS.map((_, dayOfWeek) => ({ dayOfWeek, openTime: 9 * 60, closeTime: 18 * 60 }));
}

export function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function timeToMinutes(value: string) {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}
