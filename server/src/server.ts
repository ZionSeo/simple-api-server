import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addTrainingExample,
  listSubjects,
  listTrainingExamples,
  normalizeGroup,
  setSubjectGroup,
  subjectView,
} from "./cohort.js";
import { config } from "./config.js";
import { downloadCalibrationData, fetchLatestCalibration } from "./hil-client.js";
import { enqueueCalibrationJob } from "./jobs.js";
import {
  applyLogisticModel,
  listReferenceSubjects,
  modelInfo,
  referenceGroupFromBody,
  referenceSummary,
  setReferenceGroup,
} from "./logistic.js";
import { parseNdjsonGz } from "./ndjson.js";
import { getDataset, getJob, listDatasets, listJobs } from "./store.js";
import { pullGripSet, pullMotionSet } from "./subject-sync.js";
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

function finiteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function handleCalibrationComplete(
  req: express.Request,
  res: express.Response
) {
  const individual_seq = finiteNumber(req.body?.individual_seq);
  const pathSeq = finiteNumber(req.params.calibration_seq);
  const bodySeq = finiteNumber(req.body?.calibration_seq);
  if (pathSeq !== undefined && bodySeq !== undefined && pathSeq !== bodySeq) {
    res.status(400).json({
      ok: false,
      response: "invalid_request",
      message: "경로의 calibration_seq와 본문의 calibration_seq가 다릅니다.",
    });
    return;
  }
  const calibration_seq = pathSeq ?? bodySeq;
  const body_part = parseBodyPart(req.query.body_part);
  const kind = parseKind(req.query.kind);

  if (individual_seq === undefined || calibration_seq === undefined) {
    res.status(400).json({
      ok: false,
      response: "invalid_request",
      message:
        "individual_seq(본문)와 calibration_seq(경로 또는 본문)가 필요합니다.",
    });
    return;
  }
  if (!body_part || !kind) {
    res.status(400).json({
      ok: false,
      response: "invalid_request",
      message:
        "query body_part, kind가 필요합니다. body_part는 arm_r, arm_l, leg_r, leg_l, head, chest 중 하나이고 kind는 imu 또는 emg입니다.",
    });
    return;
  }

  const job = enqueueCalibrationJob({
    individual_seq,
    calibration_seq,
    body_part,
    kind,
  });

  res.json({
    ok: true,
    response: "success",
    calibration_seq,
    job_id: job.id,
  });
}

app.get("/api/calibration/complete", (_req, res) => {
  res.json({
    ok: true,
    message:
      "이 URL은 POST 전용입니다. 브라우저 GET으로는 안내만 반환합니다.",
    method: "POST",
    path: "/api/calibration/complete",
    query_required: {
      body_part: [...BODY_PARTS],
      kind: [...KINDS],
    },
    body_example: { individual_seq: 15, calibration_seq: 101 },
    path_example: "/api/calibration/complete/101?body_part=arm_r&kind=imu",
  });
});

app.post("/api/calibration/complete", handleCalibrationComplete);
app.post("/api/calibration/complete/:calibration_seq", handleCalibrationComplete);

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

function individualParam(value: string | undefined): number | undefined {
  const seq = Number(value);
  return Number.isFinite(seq) ? seq : undefined;
}

app.get("/api/subjects", (_req, res) => {
  res.json({
    ok: true,
    subjects: listSubjects().map(subjectView),
    examples: listTrainingExamples(),
  });
});

app.post("/api/subjects/:individualSeq/group", (req, res) => {
  const individual_seq = individualParam(req.params.individualSeq);
  const group = normalizeGroup(req.body?.group);
  if (individual_seq === undefined || !group) {
    res.status(400).json({
      ok: false,
      message: "individual_seq와 group(정상 또는 근감소)이 필요합니다.",
    });
    return;
  }
  res.json({ ok: true, subject: subjectView(setSubjectGroup(individual_seq, group)) });
});

app.post("/api/subjects/:individualSeq/grip", async (req, res) => {
  const individual_seq = individualParam(req.params.individualSeq);
  if (individual_seq === undefined) {
    res.status(400).json({ ok: false, message: "individual_seq가 올바르지 않습니다." });
    return;
  }
  try {
    res.json(await pullGripSet(individual_seq));
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/subjects/:individualSeq/motion", async (req, res) => {
  const individual_seq = individualParam(req.params.individualSeq);
  const session_seq = Number(req.body?.session_seq);
  if (individual_seq === undefined || !Number.isFinite(session_seq)) {
    res.status(400).json({
      ok: false,
      message: "individual_seq와 session_seq가 필요합니다.",
    });
    return;
  }
  try {
    res.json(await pullMotionSet(individual_seq, session_seq));
  } catch (error) {
    res.status(502).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/subjects/:individualSeq/training", (req, res) => {
  const individual_seq = individualParam(req.params.individualSeq);
  const session_seq = Number(req.body?.session_seq);
  if (individual_seq === undefined || !Number.isFinite(session_seq)) {
    res.status(400).json({
      ok: false,
      message: "individual_seq와 session_seq가 필요합니다.",
    });
    return;
  }
  try {
    const example = addTrainingExample(individual_seq, session_seq);
    res.json({ ok: true, example });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/api/reference", (_req, res) => {
  const subjects = listReferenceSubjects();
  res.json({
    ok: true,
    model: modelInfo(),
    subjects,
    summary: referenceSummary(subjects),
  });
});

app.post("/api/reference/group", (req, res) => {
  const subjectId = String(req.body?.subject_id ?? "");
  const group = referenceGroupFromBody(req.body?.group);
  if (!subjectId || !group) {
    res.status(400).json({
      ok: false,
      message: "subject_id와 group(정상 또는 근감소)이 필요합니다.",
    });
    return;
  }
  try {
    res.json({ ok: true, subject: setReferenceGroup(subjectId, group) });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post("/api/model/apply", (_req, res) => {
  res.json(applyLogisticModel());
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
