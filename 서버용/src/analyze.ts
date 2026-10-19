import { summarizeNdjsonGz } from "./ndjson.js";
import type { AnalysisResult } from "./types.js";

/** 가벼운 전처리/요약 분석 (스트림 기반) */
export async function analyzeDatasetFile(
  filePath: string
): Promise<AnalysisResult> {
  const summary = await summarizeNdjsonGz(filePath, 5);
  return {
    lineCount: summary.lineCount,
    fields: summary.fields,
    sample: summary.sample,
    finishedAt: new Date().toISOString(),
  };
}
