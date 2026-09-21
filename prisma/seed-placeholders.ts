import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const PALETTE = ["#c8391f", "#e8a13a", "#8a3b1f", "#3c7a3f", "#c8391f"];

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
    <circle cx="400" cy="330" r="180" fill="#fdf6ec" opacity="0.12" />
    <circle cx="400" cy="330" r="120" fill="#fdf6ec" opacity="0.16" />
    <text x="400" y="620" text-anchor="middle" font-family="Georgia, serif" font-size="46" fill="#fdf6ec" font-weight="600">${escapeXml(
      label
    )}</text>
    <text x="400" y="670" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#fdf6ec" opacity="0.85">La Storia</text>
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
