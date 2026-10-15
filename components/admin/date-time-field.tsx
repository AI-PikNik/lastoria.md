"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

/** Время с шагом 15 минут для выпадающего списка */
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function split(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return { day: "", time: "00:00" };
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/**
 * Дата и время без ручного ввода: календарь для даты, список для времени
 * (шаг 15 мин, можно выбрать и «23:59»), быстрые кнопки. Время — по часам
 * компьютера администратора (Кишинёв); в форму уходит точный момент (ISO).
 */
export function DateTimeField({
  name,
  label,
  defaultValue,
  presets = "start",
  error,
}: {
  name: string;
  label: string;
  /** ISO-строка */
  defaultValue?: string | null;
  presets?: "start" | "end";
  error?: string;
}) {
  const [day, setDay] = React.useState("");
  const [time, setTime] = React.useState("00:00");

  // Часовой пояс известен только в браузере — заполняем после загрузки
  React.useEffect(() => {
    queueMicrotask(() => {
      const initial = split(defaultValue ? new Date(defaultValue) : presets === "start" ? new Date() : null);
      setDay(initial.day);
      setTime(initial.time);
    });
  }, [defaultValue, presets]);

  const iso = day ? new Date(`${day}T${time}:00`).toISOString() : "";
  const times = TIMES.includes(time) ? [...TIMES, "23:59"] : [...TIMES, "23:59", time].sort();

  const setDate = (date: Date) => {
    const parts = split(date);
    setDay(parts.day);
    setTime(parts.time);
  };
  const addDays = (days: number, endOfDay = false) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    if (endOfDay) d.setHours(23, 59, 0, 0);
    else d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
    setDate(d);
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex gap-2">
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="flex-1" aria-label={`${label}: дата`} />
        <div className="w-28">
          <NativeSelect value={time} onChange={(e) => setTime(e.target.value)} aria-label={`${label}: время`}>
            {times.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets === "start" ? (
          <>
            <Preset onClick={() => addDays(0)}>Сейчас</Preset>
            <Preset onClick={() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); setDate(d); }}>Завтра с 00:00</Preset>
          </>
        ) : (
          <>
            <Preset onClick={() => addDays(0, true)}>Сегодня до 23:59</Preset>
            <Preset onClick={() => addDays(7, true)}>+7 дней</Preset>
            <Preset onClick={() => addDays(30, true)}>+30 дней</Preset>
            <Preset onClick={() => addDays(365, true)}>+1 год</Preset>
          </>
        )}
      </div>
      <input type="hidden" name={name} value={iso} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  );
}

function Preset({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border-strong bg-white px-2.5 py-1 text-xs font-medium hover:border-primary hover:text-primary"
    >
      {children}
    </button>
  );
}
