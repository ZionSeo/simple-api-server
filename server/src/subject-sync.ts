import fs from "node:fs";
import path from "node:path";
import { attachGripFile, attachMotion, ensureSubject, getSubject, subjectView } from "./cohort.js";
import { downloadCalibrationData, downloadMotionExport, fetchLatestCalibration } from "./hil-client.js";
import { countNdjsonGzLines } from "./ndjson.js";
import { getDataDir } from "./store.js";
import { BODY_PARTS, KINDS, type BodyPart, type Kind } from "./types.js";

function isBodyPart(value: string): value is BodyPart {
  return (BODY_PARTS as readonly string[]).includes(value);
}

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value);
}

export async function pullGripSet(individual_seq: number) {
  ensureSubject(individual_seq);
  const latest = await fetchLatestCalibration(individual_seq);
  const saved: Array<{ body_part: BodyPart; kind: Kind; fileName: string }> = [];
  const errors: Array<{ body_part: string; kind: string; message: string }> = [];

  for (const part of latest.body_parts ?? []) {
    if (!isBodyPart(part.body_part)) continue;
    const kinds = (part.files ?? []).map((file) => file.kind).filter(isKind);
    const targets = kinds.length ? kinds : (["imu", "emg"] as Kind[]);
    for (const kind of targets) {
      try {
        const downloaded = await downloadCalibrationData({
          calibration_seq: latest.calibration_seq,
          body_part: part.body_part,
          kind,
        });
        const fileName = `${latest.calibration_seq}_${part.body_part}_${kind}_${Date.now()}.ndjson.gz`;
        const filePath = path.join(getDataDir(), fileName);
        await fs.promises.writeFile(filePath, downloaded.buffer);
        const lineCount = await countNdjsonGzLines(filePath);
        attachGripFile({
          individual_seq,
          calibration_seq: latest.calibration_seq,
          body_part: part.body_part,
          kind,
          fileName,
          byteSize: downloaded.buffer.byteLength,
          lineCount,
          source: downloaded.source,
          savedAt: new Date().toISOString(),
        });
        saved.push({ body_part: part.body_part, kind, fileName });
      } catch (error) {
        errors.push({
          body_part: part.body_part,
          kind,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const subject = getSubject(individual_seq);
  return {
    ok: errors.length === 0,
    calibration_seq: latest.calibration_seq,
    source: latest.source ?? "hil",
    saved,
    errors,
    subject: subject ? subjectView(subject) : null,
  };
}

export async function pullMotionSet(individual_seq: number, session_seq: number) {
  ensureSubject(individual_seq);
  const downloaded = await downloadMotionExport(session_seq);
  const filePath = path.join(getDataDir(), downloaded.fileName);
  await fs.promises.writeFile(filePath, downloaded.buffer);
  const subject = attachMotion(individual_seq, {
    session_seq,
    fileName: downloaded.fileName,
    byteSize: downloaded.buffer.byteLength,
    source: downloaded.source,
    savedAt: new Date().toISOString(),
  });
  return {
    ok: true,
    source: downloaded.source,
    fileName: downloaded.fileName,
    subject: subjectView(subject),
  };
}
