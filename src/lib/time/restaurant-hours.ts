export type RestaurantHours = {
  opening_time: string | null;
  closing_time: string | null;
  temporary_closed: boolean;
  temporary_closed_at: string | null;
};

export type RestaurantOperatingStatus =
  | { status: "NOT_CONFIGURED" }
  | { status: "OPEN" }
  | { status: "TEMPORARILY_CLOSED" }
  | { status: "OUTSIDE_HOURS"; nextOpeningAt: string };

const TIME_ZONE = "Asia/Jakarta";

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function previousDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const prior = new Date(Date.UTC(year, month - 1, day - 1));
  return `${prior.getUTCFullYear()}-${String(prior.getUTCMonth() + 1).padStart(2, "0")}-${String(prior.getUTCDate()).padStart(2, "0")}`;
}

function openingInstant(date: string, openingTime: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = openingTime.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute)).getTime();
}

export function getRestaurantOperatingStatus(settings: RestaurantHours, now = new Date()): RestaurantOperatingStatus {
  if (!settings.opening_time || !settings.closing_time) return { status: "NOT_CONFIGURED" };

  const parts = localParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const nowMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const [openHour, openMinute] = settings.opening_time.split(":").map(Number);
  const [closeHour, closeMinute] = settings.closing_time.split(":").map(Number);
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;
  const overnight = closeMinutes < openMinutes;
  const isOpen = overnight
    ? nowMinutes >= openMinutes || nowMinutes < closeMinutes
    : nowMinutes >= openMinutes && nowMinutes < closeMinutes;

  if (settings.temporary_closed && settings.temporary_closed_at) {
    const lastOpeningDate = nowMinutes >= openMinutes ? date : previousDate(date);
    if (new Date(settings.temporary_closed_at).getTime() >= openingInstant(lastOpeningDate, settings.opening_time)) {
      return { status: "TEMPORARILY_CLOSED" };
    }
  } else if (settings.temporary_closed) {
    return { status: "TEMPORARILY_CLOSED" };
  }

  if (isOpen) return { status: "OPEN" };
  const nextDate = nowMinutes < openMinutes ? date : (() => {
    const [year, month, day] = date.split("-").map(Number);
    const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
    return `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
  })();
  const iso = new Date(openingInstant(nextDate, settings.opening_time)).toISOString();
  return { status: "OUTSIDE_HOURS", nextOpeningAt: iso };
}
