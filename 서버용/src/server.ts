import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { downloadCalibrationData, fetchLatestCalibration } from "./hil-client.js";
import { enqueueCalibrationJob } from "./jobs.js";
import { parseNdjsonGz } from "./ndjson.js";
import { getDataset, getJob, listDatasets, listJobs } from "./store.js";
import { BODY_PARTS, KINDS, type BodyPart, type Kind } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));
app.use(express.static(publicDir));

function parseBodyPart(value: unknown): BodyPart | undefined {
  const v = String(value ?? "");
  return (BODY_PARTS as readonly string[]).includes(v)
    ? (v as BodyPart)
    : undefined;
}

function parseKind(value: unknown): Kind | undefined {
  const v = String(value ?? "");
  return (KINDS as readonly string[]).includes(v) ? (v as Kind) : undefined;
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    runtime: "express-light",
    port: config.port,
    publicBaseUrl: config.publicBaseUrl,
    notifyUrl: `${config.publicBaseUrl}/api/calibration/complete`,
    hilBaseUrl: config.hilBaseUrl,
    hilMode: config.hilMode,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  });
});

app.get("/api/status", (_req, res) => {
  res.json({
    status: "ok",
    port: config.port,
    publicBaseUrl: config.publicBaseUrl,
    notifyUrl: `${config.publicBaseUrl}/api/calibration/complete`,
    hilBaseUrl: config.hilBaseUrl,
    hilMode: config.hilMode,
    memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    jobs: listJobs().slice(0, 50),
    datasets: listDatasets()
      .slice(0, 50)
      .map(({ filePath, analysis, ...rest }) => ({
        ...rest,
        fileName: path.basename(filePath),
        hasAnalysis: Boolean(analysis),
        analysisSummary: analysis
          ? {
              lineCount: analysis.lineCount,
              fieldCount: Object.keys(analysis.fields).length,
              finishedAt: analysis.finishedAt,
            }
          : undefined,
      })),
  });
});

app.get("/api/jobs", (_req, res) => {
  res.json({ ok: true, jobs: listJobs() });
});

app.get("/api/jobs/:id", (req, res) => {
  const job = getJobOr404(req.params.id, res);
  if (!job) return;
  res.json({ ok: true, job });
});

function getJobOr404(id: string, res: express.Response) {
  const job = getJob(id);
  if (!job) {
    res.status(404).json({ ok: false, message: "job not found" });
    return null;
  }
  return job;
}

app.get("/api/datasets", (_req, res) => {
  res.json({
    ok: true,
    datasets: listDatasets().map(({ filePath, ...rest }) => ({
      ...rest,
      fileName: path.basename(filePath),
    })),
  });
});

app.get("/api/datasets/:id/preview", async (req, res) => {
  const dataset = getDataset(req.params.id);
  if (!dataset) {
    res.status(404).json({ ok: false, message: "dataset not found" });
    return;
  }
  const limit = Number(req.query.limit || 20);
  try {
    const preview = await parseNdjsonGz(
      dataset.filePath,
      Number.isFinite(limit) ? limit : 20
    );
    res.json({
      ok: true,
      dataset: {
        id: dataset.id,
        individual_seq: dataset.individual_seq,
        calibration_seq: dataset.calibration_seq,
        body_part: dataset.body_part,
        kind: dataset.kind,
        lineCount: dataset.lineCount,
        byteSize: dataset.byteSize,
        source: dataset.source,
        analysis: dataset.analysis,
      },
      totalLines: preview.totalLines,
      lines: preview.lines,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/calibration/complete", (_req, res) => {
  res.json({
    ok: true,
    message:
      "이 URL은 POST 전용입니다. 브라우저 GET으로는 안내만 반환합니다.",
    method: "POST",
    path: "/api/calibration/complete",
    body_example: { individual_seq: 15, calibration_seq: 101 },
  });
});

app.post("/api/calibration/complete", (req, res) => {
  const individual_seq = Number(
    req.body?.individual_seq ?? req.query.individual_seq
  );
  const calibration_seq = Number(
    req.body?.calibration_seq ?? req.query.calibration_seq
  );

  if (!Number.isFinite(individual_seq) || !Number.isFinite(calibration_seq)) {
    res.status(400).json({
      ok: false,
      response: "invalid_request",
      message: "individual_seq와 calibration_seq가 필요합니다.",
    });
    return;
  }

  const body_part =
    parseBodyPart(req.body?.body_part) ?? parseBodyPart(req.query.body_part);
  const kind = parseKind(req.body?.kind) ?? parseKind(req.query.kind);

  const job = enqueueCalibrationJob({
    individual_seq,
    calibration_seq,
    body_part,
    kind,
  });

  // 즉시 200 — 다운로드/분석은 워커가 백그라운드 처리
  res.json({
    ok: true,
    response: "success",
    calibration_seq,
    job_id: job.id,
  });
});

app.get("/api/hil/latest/:individualSeq", async (req, res) => {
  const seq = Number(req.params.individualSeq);
  if (!Number.isFinite(seq)) {
    res.status(400).json({ ok: false, message: "invalid individual_seq" });
    return;
  }
  try {
    res.json(await fetchLatestCalibration(seq));
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/hil/data", async (req, res) => {
  const calibration_seq = Number(req.query.calibration_seq);
  const body_part = parseBodyPart(req.query.body_part);
  const kind = parseKind(req.query.kind);
  if (!Number.isFinite(calibration_seq) || !body_part || !kind) {
    res.status(400).json({
      ok: false,
      message: "calibration_seq, body_part, kind가 필요합니다.",
    });
    return;
  }
  try {
    const downloaded = await downloadCalibrationData({
      calibration_seq,
      body_part,
      kind,
    });
    res.setHeader("Content-Type", downloaded.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="calibration_${calibration_seq}_${body_part}_${kind}.ndjson.gz"`
    );
    res.setHeader("X-Data-Source", downloaded.source);
    res.send(downloaded.buffer);
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/test", (_req, res) => {
  res.json({ ok: true, message: "success" });
});
app.post("/api/test", (_req, res) => {
  res.json({ ok: true, message: "success" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`경량 분석 서버: http://127.0.0.1:${config.port}`);
  console.log(`알림 URL: ${config.publicBaseUrl}/api/calibration/complete`);
  console.log(`HIL mode=${config.hilMode} base=${config.hilBaseUrl}`);
});
