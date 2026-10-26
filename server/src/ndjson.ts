import fs from "node:fs";
import readline from "node:readline";
import zlib from "node:zlib";

export async function parseNdjsonGz(
  filePath: string,
  limit = 50
): Promise<{ lines: Record<string, unknown>[]; totalLines: number }> {
  const lines: Record<string, unknown>[] = [];
  let totalLines = 0;

  const input = fs.createReadStream(filePath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalLines += 1;
    if (lines.length < limit) {
      lines.push(JSON.parse(line) as Record<string, unknown>);
    }
  }

  return { lines, totalLines };
}

export async function countNdjsonGzLines(filePath: string): Promise<number> {
  const { totalLines } = await parseNdjsonGz(filePath, 0);
  return totalLines;
}

/** 스트림으로 숫자 필드 통계 계산 (파일 전체를 문자열로 올리지 않음) */
export async function summarizeNdjsonGz(
  filePath: string,
  sampleLimit = 5
): Promise<{
  lineCount: number;
  fields: Record<
    string,
    { count: number; min: number; max: number; mean: number }
  >;
  sample: Record<string, unknown>[];
}> {
  const acc: Record<
    string,
    { count: number; min: number; max: number; sum: number }
  > = {};
  const sample: Record<string, unknown>[] = [];
  let lineCount = 0;

  const input = fs.createReadStream(filePath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    lineCount += 1;
    const row = JSON.parse(line) as Record<string, unknown>;
    if (sample.length < sampleLimit) sample.push(row);

    for (const [key, value] of Object.entries(row)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const cur = acc[key] ?? {
        count: 0,
        min: value,
        max: value,
        sum: 0,
      };
      cur.count += 1;
      cur.min = Math.min(cur.min, value);
      cur.max = Math.max(cur.max, value);
      cur.sum += value;
      acc[key] = cur;
    }
  }

  const fields: Record<
    string,
    { count: number; min: number; max: number; mean: number }
  > = {};
  for (const [key, cur] of Object.entries(acc)) {
    fields[key] = {
      count: cur.count,
      min: cur.min,
      max: cur.max,
      mean: cur.sum / cur.count,
    };
  }

  return { lineCount, fields, sample };
}

export async function buildMockNdjsonGz(options: {
  calibration_seq: number;
  body_part: string;
  kind: "imu" | "emg";
  rows?: number;
}): Promise<Buffer> {
  const rows = options.rows ?? (options.kind === "imu" ? 20 : 40);
  const lines: string[] = [];
  const base = Date.now();

  for (let i = 0; i < rows; i++) {
    if (options.kind === "imu") {
      lines.push(
        JSON.stringify({
          calibration_seq: options.calibration_seq,
          body_part: options.body_part,
          kind: "imu",
          timestamp: new Date(base + i * 10).toISOString(),
          acc_x: Number((Math.sin(i / 5) * 0.2).toFixed(5)),
          acc_y: Number((Math.cos(i / 7) * 0.15).toFixed(5)),
          acc_z: Number((0.98 + Math.sin(i / 11) * 0.02).toFixed(5)),
          gyro_x: Number((Math.sin(i / 3) * 0.01).toFixed(5)),
          gyro_y: Number((Math.cos(i / 4) * 0.01).toFixed(5)),
          gyro_z: Number((Math.sin(i / 9) * 0.01).toFixed(5)),
        })
      );
    } else {
      lines.push(
        JSON.stringify({
          calibration_seq: options.calibration_seq,
          body_part: options.body_part,
          kind: "emg",
          timestamp: new Date(base + i * 2).toISOString(),
          ch1: Number((Math.sin(i / 8) * 120).toFixed(3)),
          ch2: Number((Math.cos(i / 6) * 90).toFixed(3)),
          ch3: Number((Math.sin(i / 12) * 70).toFixed(3)),
          ch4: Number((Math.cos(i / 10) * 50).toFixed(3)),
        })
      );
    }
  }

  return zlib.gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8"));
}
