import { readFileSync, writeFileSync } from "node:fs";
import { pack, type Job } from "./pack.js";
import { drawing } from "./svg.js";

const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: node dist/cli.js <job.json>\n");
  process.exit(1);
}

const job = JSON.parse(readFileSync(file, "utf8")) as Job;
const plan = pack(job);
const svgPath = file.replace(/\.json$/i, "") + ".svg";
writeFileSync(svgPath, drawing(plan, job.sheet));
const left = plan.left.map((piece) => `${piece.name} x${piece.qty}`).join(", ");
process.stdout.write(
  `sheets ${plan.sheets}\nyield ${(plan.yield * 100).toFixed(1)}%\nused ${plan.used}\nleft ${left || "none"}\nwrote ${svgPath}\n`,
);
