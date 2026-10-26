import { config } from "./config.js";
import { buildMockNdjsonGz } from "./ndjson.js";
import {
  BODY_PARTS,
  type BodyPart,
  type HilLatestResponse,
  type Kind,
} from "./types.js";

function mockLatest(individual_seq: number): HilLatestResponse {
  const calibration_seq = 101;
  return {
    ok: true,
    individual_seq,
    calibration_seq,
    created_time: new Date().toISOString(),
    source: "mock",
    body_parts: BODY_PARTS.map((body_part) => ({
      body_part,
      imu_count: 12000,
      emg_count: 240000,
      files: [
        {
          kind: "imu",
          url: `/calibration/${calibration_seq}/data?body_part=${body_part}&kind=imu`,
        },
        {
          kind: "emg",
          url: `/calibration/${calibration_seq}/data?body_part=${body_part}&kind=emg`,
        },
      ],
    })),
  };
}

export async function fetchLatestCalibration(
  individual_seq: number
): Promise<HilLatestResponse> {
  if (config.hilMode === "mock") return mockLatest(individual_seq);

  const url = `${config.hilBaseUrl}/calibration/latest/${individual_seq}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HIL latest HTTP ${res.status}`);
  const data = (await res.json()) as HilLatestResponse;
  return { ...data, source: "hil" };
}

export async function downloadCalibrationData(options: {
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
}): Promise<{ buffer: Buffer; source: "hil" | "mock"; contentType: string }> {
  if (config.hilMode === "mock") {
    return {
      buffer: await buildMockNdjsonGz(options),
      source: "mock",
      contentType: "application/gzip",
    };
  }

  const params = new URLSearchParams({
    body_part: options.body_part,
    kind: options.kind,
  });
  const url = `${config.hilBaseUrl}/calibration/${options.calibration_seq}/data?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HIL data HTTP ${res.status}`);
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    source: "hil",
    contentType: res.headers.get("content-type") || "application/gzip",
  };
}

const MAX_MOTION_BYTES = 200 * 1024 * 1024;

export async function downloadMotionExport(sessionSeq: number): Promise<{
  buffer: Buffer;
  source: "hil" | "mock";
  contentType: string;
  fileName: string;
}> {
  const fileName = `session_${sessionSeq}.zip`;
  if (config.hilMode === "mock") {
    return {
      buffer: Buffer.from(
        JSON.stringify({
          mock: true,
          session_seq: sessionSeq,
          body_parts: BODY_PARTS,
        }),
        "utf8"
      ),
      source: "mock",
      contentType: "application/json",
      fileName: `session_${sessionSeq}.json`,
    };
  }

  const url = `${config.hilBaseUrl}/export/all/${sessionSeq}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HIL 동작 세트 HTTP ${res.status}`);
  const length = Number(res.headers.get("content-length") || 0);
  if (length > MAX_MOTION_BYTES) throw new Error("동작 세트가 너무 큽니다.");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_MOTION_BYTES) throw new Error("동작 세트가 너무 큽니다.");
  return {
    buffer,
    source: "hil",
    contentType: res.headers.get("content-type") || "application/zip",
    fileName,
  };
}
