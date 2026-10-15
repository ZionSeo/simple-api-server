import fs from "fs";
import path from "path";
import type { AnalysisJob, DatasetRecord } from "@/lib/types";

type StoreShape = {
  jobs: AnalysisJob[];
  datasets: DatasetRecord[];
};

declare global {
  var __gripStore: StoreShape | undefined;
}

function getStore(): StoreShape {
  if (!globalThis.__gripStore) {
    globalThis.__gripStore = { jobs: [], datasets: [] };
  }
  return globalThis.__gripStore;
}

export function getDataDir() {
  const dir =
    process.env.DATA_DIR || path.join(process.cwd(), "data", "downloads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function listJobs() {
  return [...getStore().jobs].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function getJob(id: string) {
  return getStore().jobs.find((j) => j.id === id);
}

export function upsertJob(job: AnalysisJob) {
  const store = getStore();
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) store.jobs[idx] = job;
  else store.jobs.unshift(job);
  return job;
}

export function listDatasets() {
  return [...getStore().datasets].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
}

export function getDataset(id: string) {
  return getStore().datasets.find((d) => d.id === id);
}

export function addDataset(dataset: DatasetRecord) {
  getStore().datasets.unshift(dataset);
  return dataset;
}
