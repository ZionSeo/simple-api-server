import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { downloadCalibrationData, fetchLatestCalibration } from "@/lib/hil-client";
import { countNdjsonGzLines } from "@/lib/ndjson";
import {
  addDataset,
  getDataDir,
  getJob,
  upsertJob,
} from "@/lib/store";
import {
  BODY_PARTS,
  KINDS,
  type AnalysisJob,
  type BodyPart,
  type CalibrationCompletePayload,
  type Kind,
} from "@/lib/types";

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
    message: "알림 수신. HIL 데이터 조회 대기 중",
    createdAt,
    updatedAt: createdAt,
    datasetIds: [],
  };
  upsertJob(job);
  // fire-and-forget
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
    const targets: Array<{ body_part: BodyPart; kind: Kind }> = [];

    if (job.body_part && job.kind) {
      targets.push({ body_part: job.body_part, kind: job.kind });
    } else {
      const latest = await fetchLatestCalibration(job.individual_seq);
      const parts =
        latest.body_parts?.map((b) => b.body_part) ??
        ([...BODY_PARTS] as BodyPart[]);
      for (const body_part of parts) {
        for (const kind of KINDS) {
          if (job.body_part && job.body_part !== body_part) continue;
          if (job.kind && job.kind !== kind) continue;
          targets.push({ body_part, kind });
        }
      }
      // 알림에 body_part/kind가 없으면 기본으로 arm_r imu/emg만 (전체는 너무 큼)
      if (!job.body_part && !job.kind) {
        targets.length = 0;
        targets.push(
          { body_part: "arm_r", kind: "imu" },
          { body_part: "arm_r", kind: "emg" }
        );
      }
    }

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
    current.status = "done";
    current.datasetIds = datasetIds;
    current.message = `다운로드 완료 (${datasetIds.length}개). 전처리 대기`;
    current.updatedAt = nowIso();
    upsertJob(current);
  } catch (error) {
    const current = getJob(jobId);
    if (!current) return;
    current.status = "failed";
    current.error = error instanceof Error ? error.message : String(error);
    current.message = "다운로드/처리 실패";
    current.updatedAt = nowIso();
    upsertJob(current);
  }
}
