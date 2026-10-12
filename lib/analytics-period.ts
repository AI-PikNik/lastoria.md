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
