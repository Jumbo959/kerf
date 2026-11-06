import type { Plan, Sheet } from "./pack.js";

function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function drawing(plan: Plan, sheet: Sheet) {
  if (plan.sheets === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="80" viewBox="0 0 320 80"><text x="16" y="46" font-family="Segoe UI, sans-serif" font-size="18" fill="#241c14">nothing placed</text></svg>`;
  }

  const pad = 28;
  const gap = 48;
  const width = sheet.w + pad * 2;
  const height = plan.sheets * sheet.h + (plan.sheets - 1) * gap + pad * 2;
  const body: string[] = [];

  for (let i = 0; i < plan.sheets; i++) {
    const y0 = pad + i * (sheet.h + gap);
    body.push(
      `<rect x="${pad}" y="${y0}" width="${sheet.w}" height="${sheet.h}" fill="#f3efe6" stroke="#241c14" stroke-width="3"/>`,
    );
    for (const piece of plan.placed) {
      if (piece.sheet !== i) continue;
      const x = pad + piece.x;
      const y = y0 + piece.y;
      const size = Math.max(14, Math.min(42, Math.floor(Math.min(piece.w, piece.h) / 5)));
      body.push(
        `<rect x="${x}" y="${y}" width="${piece.w}" height="${piece.h}" fill="#e4d2b0" stroke="#241c14" stroke-width="2"/>`,
      );
      body.push(
        `<text x="${x + piece.w / 2}" y="${y + piece.h / 2}" fill="#241c14" font-family="Segoe UI, sans-serif" font-size="${size}" text-anchor="middle" dominant-baseline="middle">${esc(piece.name)}</text>`,
      );
    }
    for (const saw of plan.saws) {
      if (saw.sheet !== i) continue;
      body.push(
        `<line x1="${pad + saw.x1}" y1="${y0 + saw.y1}" x2="${pad + saw.x2}" y2="${y0 + saw.y2}" stroke="#c2410c" stroke-width="3" stroke-dasharray="14 8"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body.join("")}</svg>`;
}
