export const BODY_PARTS = [
  "arm_r",
  "arm_l",
  "leg_r",
  "leg_l",
  "head",
  "chest",
] as const;

export const KINDS = ["imu", "emg"] as const;

export type BodyPart = (typeof BODY_PARTS)[number];
export type Kind = (typeof KINDS)[number];
export type JobStatus = "queued" | "running" | "analyzing" | "done" | "failed";

export type CalibrationCompletePayload = {
  individual_seq: number;
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
};

export type HilBodyPartInfo = {
  body_part: BodyPart;
  imu_count: number;
  emg_count: number;
  files: Array<{ kind: Kind; url: string }>;
};

export type HilLatestResponse = {
  ok: boolean;
  individual_seq: number;
  calibration_seq: number;
  created_time: string;
  body_parts: HilBodyPartInfo[];
  source?: "hil" | "mock";
};

export type FieldStats = {
  count: number;
  min: number;
  max: number;
  mean: number;
};

export type AnalysisResult = {
  lineCount: number;
  fields: Record<string, FieldStats>;
  sample: Record<string, unknown>[];
  finishedAt: string;
};

export type DatasetRecord = {
  id: string;
  jobId: string;
  individual_seq: number;
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
  filePath: string;
  byteSize: number;
  lineCount: number;
  source: "hil" | "mock";
  createdAt: string;
  analysis?: AnalysisResult;
};

export type AnalysisJob = {
  id: string;
  individual_seq: number;
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
  status: JobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  datasetIds: string[];
  error?: string;
};
