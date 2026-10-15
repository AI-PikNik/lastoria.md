export interface PeriodRange {
  from: Date;
  to: Date;
}

/** «Сегодня» по времени Кишинёва — независимо от часового пояса сервера */
export function chisinauToday(now: Date = new Date()): PeriodRange {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Chisinau",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Chisinau", timeZoneName: "longOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  const from = new Date(`${day}T00:00:00${offset === "" ? "+00:00" : offset}`);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

/** Шаг графика: часы (для одного дня), дни, недели, месяцы */
export type Granularity = "hour" | "day" | "week" | "month";

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  hour: "По часам",
  day: "По дням",
  week: "По неделям",
  month: "По месяцам",
};

const DAY = 24 * 60 * 60 * 1000;
const MONTHS_RU = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Какие шаги имеют смысл для периода (не больше ~400 точек на графике) */
export function availableGranularities(range: PeriodRange): Granularity[] {
  const days = (range.to.getTime() - range.from.getTime()) / DAY;
  const list: Granularity[] = [];
  if (days <= 3) list.push("hour");
  if (days <= 400) list.push("day");
  if (days >= 7) list.push("week");
  if (days >= 28) list.push("month");
  return list;
}

/** Шаг по умолчанию: день → часы, до ~3 месяцев → дни, больше → месяцы */
export function defaultGranularity(range: PeriodRange): Granularity {
  const days = (range.to.getTime() - range.from.getTime()) / DAY;
  if (days <= 1.5) return "hour";
  if (days <= 92) return "day";
  return "month";
}

const wallFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Chisinau",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
});

/**
 * «Настенное» время Кишинёва: дата, у которой UTC-поля (getUTCHours…) равны
 * часам/дате в Кишинёве. Так графики не зависят от часового пояса сервера.
 */
export function chisinauWall(date: Date): Date {
  const p = Object.fromEntries(wallFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour)));
}

const utc = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m, d, h));

function keyOfWall(w: Date, granularity: Granularity): string {
  const y = w.getUTCFullYear();
  const m = pad(w.getUTCMonth() + 1);
  const d = pad(w.getUTCDate());
  switch (granularity) {
    case "hour":
      return `${y}-${m}-${d}T${pad(w.getUTCHours())}`;
    case "week": {
      const start = utc(y, w.getUTCMonth(), w.getUTCDate() - ((w.getUTCDay() + 6) % 7));
      return `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`;
    }
    case "month":
      return `${y}-${m}`;
    default:
      return `${y}-${m}-${d}`;
  }
}

/** Ключ корзины (час/день/неделя с понедельника/месяц) по времени Кишинёва */
export function bucketKey(date: Date, granularity: Granularity): string {
  return keyOfWall(chisinauWall(date), granularity);
}

/** Все корзины периода по порядку — пустые тоже, чтобы на графике были нули */
export function buildBuckets(range: PeriodRange, granularity: Granularity): { key: string; label: string }[] {
  const from = chisinauWall(range.from);
  const to = chisinauWall(range.to);
  const y = from.getUTCFullYear();
  const mo = from.getUTCMonth();
  const d = from.getUTCDate();
  let cursor: Date;
  switch (granularity) {
    case "hour":
      cursor = utc(y, mo, d, from.getUTCHours());
      break;
    case "week":
      cursor = utc(y, mo, d - ((from.getUTCDay() + 6) % 7));
      break;
    case "month":
      cursor = utc(y, mo, 1);
      break;
    default:
      cursor = utc(y, mo, d);
  }
  const out: { key: string; label: string }[] = [];
  while (cursor.getTime() <= to.getTime() && out.length < 1000) {
    out.push({ key: keyOfWall(cursor, granularity), label: bucketLabel(cursor, granularity) });
    const [cy, cm, cd, ch] = [cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate(), cursor.getUTCHours()];
    cursor =
      granularity === "hour"
        ? utc(cy, cm, cd, ch + 1)
        : granularity === "week"
          ? utc(cy, cm, cd + 7)
          : granularity === "month"
            ? utc(cy, cm + 1, 1)
            : utc(cy, cm, cd + 1);
  }
  return out;
}

function bucketLabel(w: Date, granularity: Granularity): string {
  const dm = `${pad(w.getUTCDate())}.${pad(w.getUTCMonth() + 1)}`;
  switch (granularity) {
    case "hour":
      return `${pad(w.getUTCHours())}:00`;
    case "week":
      return `с ${dm}`;
    case "month":
      return `${MONTHS_RU[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
    default:
      return dm;
  }
}

/** Сколько товаров можно сравнить на одном графике (столько цветов различимы) */
export const MAX_TREND_PRODUCTS = 3;

/** Полночь по Кишинёву для календарной даты (месяц с 0; переполнение дней/месяцев допустимо) */
export function chisinauDayStart(year: number, month: number, day: number): Date {
  // 12:00 UTC — заведомо тот же календарный день в Кишинёве (UTC+2/+3)
  return chisinauToday(new Date(Date.UTC(year, month, day, 12))).from;
}

/** Период [from; to] из дней по Кишинёву: from — полночь первого, to — конец последнего */
export function chisinauDays(
  start: [number, number, number],
  endExclusive: [number, number, number]
): PeriodRange {
  return {
    from: chisinauDayStart(...start),
    to: new Date(chisinauDayStart(...endExclusive).getTime() - 1),
  };
}
