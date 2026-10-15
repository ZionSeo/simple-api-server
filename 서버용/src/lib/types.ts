export const BODY_PARTS = [
  "arm_r",
  "arm_l",
  "leg_r",
  "leg_l",
  "chest",
  "head",
] as const;

export const KINDS = ["imu", "emg"] as const;

export type BodyPart = (typeof BODY_PARTS)[number];
export type Kind = (typeof KINDS)[number];

export type JobStatus = "queued" | "running" | "done" | "failed";

export type CalibrationCompletePayload = {
  individual_seq: number;
  calibration_seq: number;
  body_part?: BodyPart;
  kind?: Kind;
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
};

export type AnalysisJob = {
  id: string;
  individual_seq: number;
  calibration_seq: number;
  body_part?: BodyPart;
  kind?: Kind;
  status: JobStatus;
  message: string;
  createdAt: string;
  updatedAt: string;
  datasetIds: string[];
  error?: string;
};
