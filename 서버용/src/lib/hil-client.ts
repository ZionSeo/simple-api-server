import { config } from "@/lib/config";
import { buildMockNdjsonGz } from "@/lib/ndjson";
import {
  BODY_PARTS,
  type BodyPart,
  type HilLatestResponse,
  type Kind,
} from "@/lib/types";

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
  if (config.hilMode === "mock") {
    return mockLatest(individual_seq);
  }

  const url = `${config.hilBaseUrl}/calibration/latest/${individual_seq}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HIL latest HTTP ${res.status}`);
    }
    const data = (await res.json()) as HilLatestResponse;
    return { ...data, source: "hil" };
  } catch (error) {
    if (config.hilMode === "live") throw error;
    return mockLatest(individual_seq);
  }
}

export async function downloadCalibrationData(options: {
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
}): Promise<{ buffer: Buffer; source: "hil" | "mock"; contentType: string }> {
  if (config.hilMode === "mock") {
    const buffer = await buildMockNdjsonGz(options);
    return {
      buffer,
      source: "mock",
      contentType: "application/gzip",
    };
  }

  const url = `${config.hilBaseUrl}/calibration/${options.calibration_seq}/data?body_part=${options.body_part}&kind=${options.kind}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HIL data HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      source: "hil",
      contentType: res.headers.get("content-type") || "application/gzip",
    };
  } catch (error) {
    if (config.hilMode === "live") throw error;
    const buffer = await buildMockNdjsonGz(options);
    return {
      buffer,
      source: "mock",
      contentType: "application/gzip",
    };
  }
}
