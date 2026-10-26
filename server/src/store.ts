import fs from "node:fs";
import path from "node:path";
import type { AnalysisJob, AnalysisResult, DatasetRecord } from "./types.js";

type StoreShape = {
  jobs: AnalysisJob[];
  datasets: DatasetRecord[];
};

const store: StoreShape = { jobs: [], datasets: [] };
const MAX_JOBS = 100;
const MAX_DATASETS = 100;

export function getDataDir() {
  const dir =
    process.env.DATA_DIR || path.join(process.cwd(), "data", "downloads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listJobs() {
  return [...store.jobs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getJob(id: string) {
  return store.jobs.find((j) => j.id === id);
}

export function upsertJob(job: AnalysisJob) {
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) store.jobs[idx] = job;
  else store.jobs.unshift(job);
  if (store.jobs.length > MAX_JOBS) store.jobs.length = MAX_JOBS;
  return job;
}

export function listDatasets() {
  return [...store.datasets].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function getDataset(id: string) {
  return store.datasets.find((d) => d.id === id);
}

export function addDataset(dataset: DatasetRecord) {
  store.datasets.unshift(dataset);
  if (store.datasets.length > MAX_DATASETS) store.datasets.length = MAX_DATASETS;
  return dataset;
}

export function setDatasetAnalysis(id: string, analysis: AnalysisResult) {
  const ds = getDataset(id);
  if (!ds) return;
  ds.analysis = analysis;
}
