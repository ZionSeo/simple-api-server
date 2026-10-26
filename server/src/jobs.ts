import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { analyzeDatasetFile } from "./analyze.js";
import { downloadCalibrationData } from "./hil-client.js";
import { countNdjsonGzLines } from "./ndjson.js";
import {
  addDataset,
  getDataDir,
  getDataset,
  getJob,
  setDatasetAnalysis,
  upsertJob,
} from "./store.js";
import type { AnalysisJob, CalibrationCompletePayload } from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

export function enqueueCalibrationJob(
  payload: CalibrationCompletePayload
): AnalysisJob {
  const createdAt = nowIso();
  const job: AnalysisJob = {
    id: randomUUID(),
    individual_seq: payload.individual_seq,
    calibration_seq: payload.calibration_seq,
    body_part: payload.body_part,
    kind: payload.kind,
    status: "queued",
    message: "알림 수신. 큐에 등록됨",
    createdAt,
    updatedAt: createdAt,
    datasetIds: [],
  };
  upsertJob(job);
  void processJob(job.id);
  return job;
}

async function processJob(jobId: string) {
  const job = getJob(jobId);
  if (!job) return;

  job.status = "running";
  job.message = "HIL에서 데이터 다운로드 중";
  job.updatedAt = nowIso();
  upsertJob(job);

  try {
    const targets = [{ body_part: job.body_part, kind: job.kind }];

    const datasetIds: string[] = [];
    for (const target of targets) {
      const downloaded = await downloadCalibrationData({
        calibration_seq: job.calibration_seq,
        body_part: target.body_part,
        kind: target.kind,
      });

      const fileName = `${job.calibration_seq}_${target.body_part}_${target.kind}_${Date.now()}.ndjson.gz`;
      const filePath = path.join(getDataDir(), fileName);
      await fs.promises.writeFile(filePath, downloaded.buffer);
      const lineCount = await countNdjsonGzLines(filePath);

      const dataset = addDataset({
        id: randomUUID(),
        jobId: job.id,
        individual_seq: job.individual_seq,
        calibration_seq: job.calibration_seq,
        body_part: target.body_part,
        kind: target.kind,
        filePath,
        byteSize: downloaded.buffer.byteLength,
        lineCount,
        source: downloaded.source,
        createdAt: nowIso(),
      });
      datasetIds.push(dataset.id);
    }

    const current = getJob(jobId);
    if (!current) return;
    current.status = "analyzing";
    current.datasetIds = datasetIds;
    current.message = `다운로드 완료 (${datasetIds.length}개). 분석 중`;
    current.updatedAt = nowIso();
    upsertJob(current);

    for (const id of datasetIds) {
      const ds = getDataset(id);
      if (!ds) continue;
      const analysis = await analyzeDatasetFile(ds.filePath);
      setDatasetAnalysis(id, analysis);
    }

    const done = getJob(jobId);
    if (!done) return;
    done.status = "done";
    done.message = `분석 완료 (${datasetIds.length}개)`;
    done.updatedAt = nowIso();
    upsertJob(done);
  } catch (error) {
    const current = getJob(jobId);
    if (!current) return;
    current.status = "failed";
    current.error = error instanceof Error ? error.message : String(error);
    current.message = "다운로드/분석 실패";
    current.updatedAt = nowIso();
    upsertJob(current);
  }
}
