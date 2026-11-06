export type Grain = "none" | "along" | "across";

export type Piece = {
  name: string;
  w: number;
  h: number;
  qty: number;
  grain: Grain;
};

export type Sheet = {
  w: number;
  h: number;
  kerf: number;
  trim: number;
};

export type Job = {
  sheet: Sheet;
  pieces: Piece[];
};

export type Placed = {
  name: string;
  sheet: number;
  x: number;
  y: number;
  w: number;
  h: number;
  turned: boolean;
};

export type Saw = {
  sheet: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Plan = {
  placed: Placed[];
  saws: Saw[];
  sheets: number;
  used: number;
  stock: number;
  yield: number;
  left: { name: string; qty: number }[];
};

type Gap = { x: number; y: number; w: number; h: number };
type Unit = { name: string; w: number; h: number; grain: Grain };
type Orient = { w: number; h: number; turned: boolean };
type Axis = "h" | "v";

const GRAINS: Grain[] = ["none", "along", "across"];

function bad(msg: string): never {
  throw new Error(msg);
}

function needInt(n: number, label: string, min: number) {
  if (!Number.isInteger(n) || n < min) bad(`${label} must be an integer >= ${min}`);
}

function orientations(unit: Unit): Orient[] {
  const straight = { w: unit.w, h: unit.h, turned: false };
  const turned = { w: unit.h, h: unit.w, turned: true };
  if (unit.w === unit.h || unit.grain === "along") return [straight];
  if (unit.grain === "across") return [turned];
  return [straight, turned];
}

function span(space: number, used: number, kerf: number) {
  if (used >= space) return 0;
  const left = space - used - kerf;
  return left > 0 ? left : 0;
}

function children(gap: Gap, w: number, h: number, kerf: number, axis: Axis): Gap[] {
  const rightW = span(gap.w, w, kerf);
  const aboveH = span(gap.h, h, kerf);
  const out: Gap[] = [];
  if (axis === "h") {
    if (rightW > 0) out.push({ x: gap.x + w + kerf, y: gap.y, w: rightW, h });
    if (aboveH > 0) out.push({ x: gap.x, y: gap.y + h + kerf, w: gap.w, h: aboveH });
    return out;
  }
  if (aboveH > 0) out.push({ x: gap.x, y: gap.y + h + kerf, w, h: aboveH });
  if (rightW > 0) out.push({ x: gap.x + w + kerf, y: gap.y, w: rightW, h: gap.h });
  return out;
}

function rank(gaps: Gap[]): [number, number] {
  let max = 0;
  let sum = 0;
  for (const gap of gaps) {
    const area = gap.w * gap.h;
    sum += area;
    if (area > max) max = area;
  }
  return [max, sum];
}

function chooseAxis(gap: Gap, w: number, h: number, kerf: number): Axis {
  const horizontal = rank(children(gap, w, h, kerf, "h"));
  const vertical = rank(children(gap, w, h, kerf, "v"));
  if (vertical[0] !== horizontal[0]) return vertical[0] > horizontal[0] ? "v" : "h";
  if (vertical[1] !== horizontal[1]) return vertical[1] > horizontal[1] ? "v" : "h";
  return "h";
}

function better(next: number[], prev: number[] | undefined) {
  if (!prev) return true;
  for (let i = 0; i < next.length; i++) {
    if (next[i] !== prev[i]) return next[i] < prev[i];
  }
  return false;
}

function search(gaps: Gap[], orients: Orient[], kerf: number) {
  let best: { gap: number; orient: Orient; axis: Axis; score: number[] } | null = null;
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    for (const orient of orients) {
      if (orient.w > gap.w || orient.h > gap.h) continue;
      const dw = gap.w - orient.w;
      const dh = gap.h - orient.h;
      const score = [Math.min(dw, dh), Math.max(dw, dh), gap.y, gap.x, orient.turned ? 1 : 0];
      if (!best || better(score, best.score)) {
        best = { gap: i, orient, axis: chooseAxis(gap, orient.w, orient.h, kerf), score };
      }
    }
  }
  return best;
}

function cuts(sheet: number, gap: Gap, w: number, h: number, axis: Axis): Saw[] {
  const out: Saw[] = [];
  if (axis === "h") {
    if (w < gap.w) out.push({ sheet, x1: gap.x + w, y1: gap.y, x2: gap.x + w, y2: gap.y + h });
    if (h < gap.h) out.push({ sheet, x1: gap.x, y1: gap.y + h, x2: gap.x + gap.w, y2: gap.y + h });
    return out;
  }
  if (h < gap.h) out.push({ sheet, x1: gap.x, y1: gap.y + h, x2: gap.x + w, y2: gap.y + h });
  if (w < gap.w) out.push({ sheet, x1: gap.x + w, y1: gap.y, x2: gap.x + w, y2: gap.y + gap.h });
  return out;
}

export function pack(job: Job): Plan {
  const sheet = job.sheet;
  needInt(sheet.w, "sheet width", 1);
  needInt(sheet.h, "sheet height", 1);
  needInt(sheet.kerf, "kerf", 0);
  needInt(sheet.trim, "trim", 0);
  if (sheet.trim * 2 >= sheet.w || sheet.trim * 2 >= sheet.h) bad("trim leaves no usable sheet");

  const units: Unit[] = [];
  for (const piece of job.pieces) {
    if (piece.name.trim() === "") bad("piece name is empty");
    needInt(piece.w, `${piece.name} width`, 1);
    needInt(piece.h, `${piece.name} height`, 1);
    needInt(piece.qty, `${piece.name} qty`, 1);
    if (!GRAINS.includes(piece.grain)) bad(`${piece.name} has an unknown grain`);
    for (let i = 0; i < piece.qty; i++) {
      units.push({ name: piece.name, w: piece.w, h: piece.h, grain: piece.grain });
    }
  }

  units.sort((a, b) => {
    const edge = Math.max(b.w, b.h) - Math.max(a.w, a.h);
    if (edge !== 0) return edge;
    const area = b.w * b.h - a.w * a.h;
    if (area !== 0) return area;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });

  const usableW = sheet.w - sheet.trim * 2;
  const usableH = sheet.h - sheet.trim * 2;
  const boards: Gap[][] = [];
  const placed: Placed[] = [];
  const saws: Saw[] = [];
  const leftCount = new Map<string, number>();

  for (const unit of units) {
    const orients = orientations(unit);
    if (!orients.some((orient) => orient.w <= usableW && orient.h <= usableH)) {
      leftCount.set(unit.name, (leftCount.get(unit.name) ?? 0) + 1);
      continue;
    }

    let home = -1;
    let pick = null as ReturnType<typeof search>;
    for (let s = 0; s < boards.length; s++) {
      const found = search(boards[s], orients, sheet.kerf);
      if (found && better(found.score, pick?.score)) {
        home = s;
        pick = found;
      }
    }

    if (!pick) {
      boards.push([{ x: sheet.trim, y: sheet.trim, w: usableW, h: usableH }]);
      home = boards.length - 1;
      pick = search(boards[home], orients, sheet.kerf);
    }

    if (!pick) {
      leftCount.set(unit.name, (leftCount.get(unit.name) ?? 0) + 1);
      boards.pop();
      continue;
    }

    const gap = boards[home][pick.gap];
    placed.push({
      name: unit.name,
      sheet: home,
      x: gap.x,
      y: gap.y,
      w: pick.orient.w,
      h: pick.orient.h,
      turned: pick.orient.turned,
    });
    saws.push(...cuts(home, gap, pick.orient.w, pick.orient.h, pick.axis));
    const next = boards[home].slice();
    next.splice(pick.gap, 1, ...children(gap, pick.orient.w, pick.orient.h, sheet.kerf, pick.axis));
    boards[home] = next;
  }

  const used = placed.reduce((sum, piece) => sum + piece.w * piece.h, 0);
  const sheets = boards.length;
  const stock = sheets * sheet.w * sheet.h;
  const left = [...leftCount.entries()]
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  return { placed, saws, sheets, used, stock, yield: stock === 0 ? 0 : used / stock, left };
}
