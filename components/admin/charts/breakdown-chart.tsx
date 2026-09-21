"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatMoney } from "@/lib/format";

interface BreakdownItem {
  label: string;
  revenue: number;
}

const COLORS = ["#c8391f", "#e8a13a", "#8a3b1f", "#3c7a3f", "#6b5849"];

export function BreakdownChart({ data }: { data: BreakdownItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} />
        <YAxis type="category" dataKey="label" stroke="var(--muted-foreground)" fontSize={12} width={100} />
        <Tooltip
          formatter={(value) => formatMoney(Number(value ?? 0))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Bar dataKey="revenue" name="Выручка" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
