type Hours = { opening_time: string | null; closing_time: string | null };

function localDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function shiftDate(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function getOperationalDate(now: Date, hours: Hours) {
  const parts = localDateTime(now);
  const calendarDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (!hours.opening_time || !hours.closing_time) return calendarDate;
  const opening =
    Number(hours.opening_time.slice(0, 2)) * 60 +
    Number(hours.opening_time.slice(3, 5));
  const closing =
    Number(hours.closing_time.slice(0, 2)) * 60 +
    Number(hours.closing_time.slice(3, 5));
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  return closing < opening && current < closing
    ? shiftDate(calendarDate, -1)
    : calendarDate;
}

export function shiftOperationalDate(date: string, amount: number) {
  return shiftDate(date, amount);
}
