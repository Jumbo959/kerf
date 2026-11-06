import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pack, type Job, type Piece, type Sheet } from "./pack.js";
import { drawing } from "./svg.js";

function job(sheet: Sheet, pieces: Piece[]): Job {
  return { sheet, pieces };
}

describe("pack", () => {
  it("drops a piece onto an empty sheet with no cut", () => {
    const plan = pack(
      job({ w: 100, h: 50, kerf: 0, trim: 0 }, [{ name: "a", w: 100, h: 50, qty: 1, grain: "along" }]),
    );
    assert.equal(plan.sheets, 1);
    assert.equal(plan.yield, 1);
    assert.equal(plan.saws.length, 0);
    assert.deepEqual(plan.placed[0], { name: "a", sheet: 0, x: 0, y: 0, w: 100, h: 50, turned: false });
  });

  it("keeps the kerf between two parts", () => {
    const plan = pack(
      job({ w: 204, h: 100, kerf: 4, trim: 0 }, [{ name: "a", w: 100, h: 100, qty: 2, grain: "along" }]),
    );
    assert.equal(plan.sheets, 1);
    assert.deepEqual(
      plan.placed.map((piece) => [piece.x, piece.y]),
      [
        [0, 0],
        [104, 0],
      ],
    );
  });

  it("opens another sheet when the kerf eats the gap", () => {
    const plan = pack(
      job({ w: 203, h: 100, kerf: 4, trim: 0 }, [{ name: "a", w: 100, h: 100, qty: 2, grain: "along" }]),
    );
    assert.equal(plan.sheets, 2);
    assert.deepEqual(
      plan.placed.map((piece) => piece.sheet),
      [0, 1],
    );
  });

  it("saws across the gap when the offcut above is the larger one", () => {
    const plan = pack(
      job({ w: 100, h: 100, kerf: 0, trim: 0 }, [{ name: "block", w: 60, h: 40, qty: 1, grain: "along" }]),
    );
    assert.deepEqual(plan.saws, [
      { sheet: 0, x1: 60, y1: 0, x2: 60, y2: 40 },
      { sheet: 0, x1: 0, y1: 40, x2: 100, y2: 40 },
    ]);
  });

  it("saws the full height when the side offcut is larger", () => {
    const plan = pack(
      job({ w: 100, h: 100, kerf: 0, trim: 0 }, [{ name: "stile", w: 40, h: 70, qty: 1, grain: "along" }]),
    );
    assert.deepEqual(plan.saws, [
      { sheet: 0, x1: 0, y1: 70, x2: 40, y2: 70 },
      { sheet: 0, x1: 40, y1: 0, x2: 40, y2: 100 },
    ]);
  });

  it("refuses to turn a part with grain along", () => {
    const plan = pack(
      job({ w: 50, h: 100, kerf: 0, trim: 0 }, [{ name: "rail", w: 80, h: 40, qty: 1, grain: "along" }]),
    );
    assert.equal(plan.sheets, 0);
    assert.deepEqual(plan.left, [{ name: "rail", qty: 1 }]);
  });

  it("turns a part when grain is across", () => {
    const plan = pack(
      job({ w: 50, h: 100, kerf: 0, trim: 0 }, [{ name: "rail", w: 80, h: 40, qty: 1, grain: "across" }]),
    );
    assert.equal(plan.placed[0].turned, true);
    assert.deepEqual([plan.placed[0].w, plan.placed[0].h], [40, 80]);
  });

  it("insets the usable field by trim", () => {
    const plan = pack(
      job({ w: 100, h: 100, kerf: 0, trim: 10 }, [{ name: "panel", w: 80, h: 80, qty: 1, grain: "none" }]),
    );
    assert.equal(plan.placed[0].x, 10);
    assert.equal(plan.placed[0].y, 10);
    assert.equal(plan.yield, 0.64);
  });

  it("does not follow the input order", () => {
    const pieces: Piece[] = [
      { name: "small", w: 10, h: 10, qty: 1, grain: "none" },
      { name: "large", w: 40, h: 40, qty: 1, grain: "none" },
    ];
    const first = pack(job({ w: 40, h: 40, kerf: 0, trim: 0 }, pieces));
    const second = pack(job({ w: 40, h: 40, kerf: 0, trim: 0 }, [...pieces].reverse()));
    assert.equal(pieces[0].name, "small");
    assert.deepEqual(
      first.placed.map((piece) => [piece.name, piece.sheet]),
      [
        ["large", 0],
        ["small", 1],
      ],
    );
    assert.deepEqual(first.placed, second.placed);
  });

  it("rejects a blank name and a fractional kerf", () => {
    assert.throws(
      () => pack(job({ w: 10, h: 10, kerf: 0, trim: 0 }, [{ name: " ", w: 1, h: 1, qty: 1, grain: "none" }])),
      /piece name is empty/,
    );
    assert.throws(() => pack(job({ w: 10, h: 10, kerf: 0.5, trim: 0 }, [])), /kerf/);
  });

  it("names the parts on the drawing", () => {
    const sheet = { w: 30, h: 20, kerf: 0, trim: 0 };
    const plan = pack(job(sheet, [{ name: "a&b", w: 30, h: 20, qty: 1, grain: "none" }]));
    const svg = drawing(plan, sheet);
    assert.match(svg, /a&amp;b/);
    assert.match(svg, /<svg /);
  });
});
