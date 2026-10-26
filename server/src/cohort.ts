import fs from "node:fs";
import path from "node:path";
import { getDataDir } from "./store.js";
import type { BodyPart, Kind } from "./types.js";

export type CohortGroup = "control" | "patient";

const GROUP_ALIASES: Record<string, CohortGroup> = {
  정상: "control",
  control: "control",
  근감소: "patient",
  patient: "patient",
};

export const GROUP_DISPLAY: Record<CohortGroup, string> = {
  control: "정상",
  patient: "근감소",
};

export type GripFileRef = {
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
  fileName: string;
  byteSize: number;
  lineCount: number;
  source: "hil" | "mock";
  savedAt: string;
};

export type MotionRef = {
  session_seq: number;
  fileName: string;
  byteSize: number;
  source: "hil" | "mock";
  savedAt: string;
};

export type SubjectRecord = {
  individual_seq: number;
  group: CohortGroup | null;
  grip: GripFileRef[];
  motions: MotionRef[];
  updatedAt: string;
};

export type TrainingExample = {
  id: string;
  individual_seq: number;
  group: CohortGroup;
  label: 0 | 1;
  calibration_seq: number | null;
  grip: GripFileRef[];
  motion: MotionRef;
  createdAt: string;
};

type Registry = {
  subjects: SubjectRecord[];
  examples: TrainingExample[];
};

function registryPath() {
  return path.join(path.dirname(getDataDir()), "cohort.json");
}

function emptyRegistry(): Registry {
  return { subjects: [], examples: [] };
}

function load(): Registry {
  const file = registryPath();
  if (!fs.existsSync(file)) return emptyRegistry();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Registry;
    return {
      subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
      examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    };
  } catch {
    return emptyRegistry();
  }
}

function save(registry: Registry) {
  const file = registryPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(registry, null, 2), "utf8");
}

export function normalizeGroup(value: unknown): CohortGroup | null {
  const key = String(value ?? "").trim();
  return GROUP_ALIASES[key] ?? null;
}

export function listSubjects(): SubjectRecord[] {
  return load().subjects.sort((a, b) => a.individual_seq - b.individual_seq);
}

export function listTrainingExamples(): TrainingExample[] {
  return load().examples;
}

export function getSubject(individual_seq: number): SubjectRecord | undefined {
  return load().subjects.find((item) => item.individual_seq === individual_seq);
}

export function ensureSubject(individual_seq: number): SubjectRecord {
  const registry = load();
  const found = registry.subjects.find((item) => item.individual_seq === individual_seq);
  if (found) return found;
  const created: SubjectRecord = {
    individual_seq,
    group: null,
    grip: [],
    motions: [],
    updatedAt: new Date().toISOString(),
  };
  registry.subjects.push(created);
  save(registry);
  return created;
}

export function setSubjectGroup(individual_seq: number, group: CohortGroup): SubjectRecord {
  const registry = load();
  const subject = registry.subjects.find((item) => item.individual_seq === individual_seq)
    ?? {
      individual_seq,
      group: null,
      grip: [],
      motions: [],
      updatedAt: new Date().toISOString(),
    };
  subject.group = group;
  subject.updatedAt = new Date().toISOString();
  if (!registry.subjects.includes(subject)) registry.subjects.push(subject);
  save(registry);
  return subject;
}

export function attachGripFile(file: GripFileRef & { individual_seq: number }) {
  const registry = load();
  const subject = registry.subjects.find((item) => item.individual_seq === file.individual_seq)
    ?? {
      individual_seq: file.individual_seq,
      group: null,
      grip: [],
      motions: [],
      updatedAt: new Date().toISOString(),
    };
  const { individual_seq: _seq, ...ref } = file;
  const index = subject.grip.findIndex(
    (item) =>
      item.calibration_seq === ref.calibration_seq
      && item.body_part === ref.body_part
      && item.kind === ref.kind
  );
  if (index >= 0) subject.grip[index] = ref;
  else subject.grip.push(ref);
  subject.grip.sort((a, b) =>
    a.body_part.localeCompare(b.body_part) || a.kind.localeCompare(b.kind)
  );
  subject.updatedAt = new Date().toISOString();
  if (!registry.subjects.includes(subject)) registry.subjects.push(subject);
  save(registry);
  return subject;
}

export function attachMotion(individual_seq: number, motion: MotionRef): SubjectRecord {
  const registry = load();
  const subject = registry.subjects.find((item) => item.individual_seq === individual_seq)
    ?? {
      individual_seq,
      group: null,
      grip: [],
      motions: [],
      updatedAt: new Date().toISOString(),
    };
  const index = subject.motions.findIndex((item) => item.session_seq === motion.session_seq);
  if (index >= 0) subject.motions[index] = motion;
  else subject.motions.push(motion);
  subject.motions.sort((a, b) => a.session_seq - b.session_seq);
  subject.updatedAt = new Date().toISOString();
  if (!registry.subjects.includes(subject)) registry.subjects.push(subject);
  save(registry);
  return subject;
}

export function trainingReadiness(subject: SubjectRecord): string | null {
  if (!subject.group) return "정상 또는 근감소로 분류해야 합니다.";
  if (subject.grip.length === 0) return "악력 파일이 없습니다.";
  if (subject.motions.length === 0) return "동작 세트가 없습니다.";
  return null;
}

export function addTrainingExample(
  individual_seq: number,
  session_seq: number
): TrainingExample {
  const registry = load();
  const subject = registry.subjects.find((item) => item.individual_seq === individual_seq);
  if (!subject) throw new Error("대상자가 없습니다. 먼저 HIL에서 불러오십시오.");
  const reason = trainingReadiness(subject);
  if (reason) throw new Error(reason);
  const motion = subject.motions.find((item) => item.session_seq === session_seq);
  if (!motion) throw new Error("이 대상자에 연결된 동작 세션이 아닙니다.");
  const group = subject.group;
  if (!group) throw new Error("분류가 없습니다.");
  const example: TrainingExample = {
    id: `${individual_seq}-${session_seq}-${Date.now()}`,
    individual_seq,
    group,
    label: group === "patient" ? 1 : 0,
    calibration_seq: subject.grip[0]?.calibration_seq ?? null,
    grip: subject.grip,
    motion,
    createdAt: new Date().toISOString(),
  };
  registry.examples.unshift(example);
  save(registry);
  return example;
}

export function subjectView(subject: SubjectRecord) {
  return {
    ...subject,
    group_label: subject.group ? GROUP_DISPLAY[subject.group] : "",
    ready: trainingReadiness(subject) === null,
    ready_reason: trainingReadiness(subject),
  };
}
