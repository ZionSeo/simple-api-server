import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RiskScoreResult } from "./risk-score.js";

export type StoredRisk = RiskScoreResult & {
  at: string;
  feedback?: string;
};

const MAX_RESULTS = 40;
const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "data",
  "risk-results.json"
);

const results: StoredRisk[] = load();

function load(): StoredRisk[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as StoredRisk[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RESULTS) : [];
  } catch {
    return [];
  }
}

function save() {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), "utf8");
}

export function recordRisk(result: RiskScoreResult, feedback?: string): StoredRisk {
  const row: StoredRisk = {
    ...result,
    at: new Date().toISOString(),
    feedback,
  };
  results.unshift(row);
  if (results.length > MAX_RESULTS) results.length = MAX_RESULTS;
  save();
  return row;
}

export function listRisks(): StoredRisk[] {
  return results;
}
