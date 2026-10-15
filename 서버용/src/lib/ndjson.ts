import fs from "fs";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);

async function readNdjsonText(filePath: string) {
  const compressed = await fs.promises.readFile(filePath);
  const raw = await gunzip(compressed);
  return raw.toString("utf8").trim();
}

export async function parseNdjsonGz(
  filePath: string,
  limit = 50
): Promise<{ lines: Record<string, unknown>[]; totalLines: number }> {
  const text = await readNdjsonText(filePath);
  if (!text) return { lines: [], totalLines: 0 };

  const all = text.split("\n").filter(Boolean);
  const lines = all
    .slice(0, limit)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { lines, totalLines: all.length };
}

export async function countNdjsonGzLines(filePath: string): Promise<number> {
  const text = await readNdjsonText(filePath);
  if (!text) return 0;
  return text.split("\n").filter(Boolean).length;
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

  return gzip(Buffer.from(lines.join("\n") + "\n", "utf8"));
}
