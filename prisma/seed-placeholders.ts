import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Палитра постера: винный, терракота, оливковый, кирпичный, огонь
const PALETTE = ["#7a1f1f", "#b85a32", "#4e6b3a", "#8c3b22", "#e08a2a"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildSvg(label: string, seed: number): string {
  const bg = pick(PALETTE, seed);
  const bg2 = pick(PALETTE, seed + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bg}" />
        <stop offset="100%" stop-color="${bg2}" />
      </linearGradient>
    </defs>
    <rect width="800" height="800" fill="url(#g)" />
    <rect x="24" y="24" width="752" height="752" fill="none" stroke="#c7a15a" stroke-width="4" opacity="0.8" />
    <circle cx="400" cy="330" r="180" fill="#f6ebd8" opacity="0.14" />
    <circle cx="400" cy="330" r="120" fill="#f6ebd8" opacity="0.18" />
    <text x="400" y="620" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#fff8ee" font-weight="700" font-style="italic">${escapeXml(
      label
    )}</text>
    <text x="400" y="670" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#f2c14e" opacity="0.95" font-style="italic">La Storia</text>
  </svg>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

export async function generatePlaceholder(slug: string, label: string): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", "seed");
  await mkdir(dir, { recursive: true });
  const filename = `${slug}.svg`;
  const svg = buildSvg(label, hashSeed(slug));
  await writeFile(path.join(dir, filename), svg, "utf-8");
  return `/uploads/seed/${filename}`;
}
