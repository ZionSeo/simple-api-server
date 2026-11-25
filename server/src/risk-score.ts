import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scoreExercise } from "./logistic.js";

type DomainName =
  | "movement_capacity"
  | "muscle_activation"
  | "movement_dynamics"
  | "compensation_context";

type Direction = "low_bad" | "high_bad" | "two_sided";

type ReferenceRule = {
  center: number;
  scale: number;
  direction: Direction;
};

type ExerciseSpec = {
  model: {
    mean: number[];
    scale: number[];
    coef: number[];
    intercept: number;
  };
  reference?: Record<string, ReferenceRule>;
};

type ExerciseBundle = {
  domains: DomainName[];
  grades: { low: number; high: number };
  exercises: Record<string, ExerciseSpec>;
};

const CLIP = 5.0;
const DOMAINS: DomainName[] = [
  "movement_capacity",
  "muscle_activation",
  "movement_dynamics",
  "compensation_context",
];

const DOMAIN_FEATURES: Record<DomainName, string[]> = {
  movement_capacity: [
    "shoulder_rom_deg",
    "elbow_rom_deg",
    "task_endpoint_value_deg",
    "task_endpoint_excursion_deg",
    "reach_p95_shoulder_width",
  ],
  muscle_activation: [
    "emg_active_fraction",
    "emg_rms_adc",
    "emg_waveform_length_per_s",
  ],
  movement_dynamics: [
    "imu_angular_speed_p95_deg_s",
    "imu_acceleration_dynamic_rms",
    "imu_acceleration_dynamic_p95",
    "imu_acceleration_dynamic_iqr",
    "imu_acceleration_dynamic_skewness",
  ],
  compensation_context: [
    "skeleton_trunk_sway_rom_deg",
    "skeleton_scapular_tilt_rom_deg",
    "skeleton_centerline_rom_shoulder_width",
    "imu_chest_roll_rom_deg",
    "imu_chest_pitch_rom_deg",
  ],
};

const TASK_COLUMNS: Record<string, [string, string]> = {
  shoulder_press: ["shoulder_peak_deg", "shoulder_positive_excursion_deg"],
  arm_curl: ["elbow_flexion_amount_deg", "elbow_flexion_excursion_deg"],
  overhead_triceps_extension: [
    "elbow_extension_endpoint_deg",
    "elbow_extension_excursion_deg",
  ],
  chest_press: ["elbow_extension_endpoint_deg", "elbow_extension_excursion_deg"],
  seated_row: ["elbow_flexion_amount_deg", "elbow_flexion_excursion_deg"],
};

const SHARED = new Set([
  "skeleton_trunk_sway_rom_deg",
  "skeleton_scapular_tilt_rom_deg",
  "skeleton_centerline_rom_shoulder_width",
  "imu_chest_roll_rom_deg",
  "imu_chest_pitch_rom_deg",
]);

const dataDir = path.dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(
  fs.readFileSync(path.join(dataDir, "..", "data", "exercise-models.json"), "utf8")
) as ExerciseBundle;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOf(features: Record<string, unknown>, key: string): number {
  const value = features[key];
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

function deviation(
  value: number,
  center: number,
  scale: number,
  direction: Direction
): number {
  if (!Number.isFinite(value) || !Number.isFinite(center) || !Number.isFinite(scale) || scale <= 1e-12) {
    return Number.NaN;
  }
  const signed = (value - center) / scale;
  let amount = 0;
  if (direction === "low_bad") amount = Math.max(-signed, 0);
  else if (direction === "high_bad") amount = Math.max(signed, 0);
  else amount = Math.abs(signed);
  return Math.min(amount, CLIP);
}

function rawFeature(
  features: Record<string, unknown>,
  feature: string,
  sideCode: string,
  exercise: string
): number {
  if (SHARED.has(feature)) return numberOf(features, feature);
  if (feature === "shoulder_rom_deg") {
    return numberOf(features, `skeleton_arm_${sideCode}_shoulder_rom_deg`);
  }
  if (feature === "elbow_rom_deg") {
    return numberOf(features, `skeleton_arm_${sideCode}_elbow_rom_deg`);
  }
  if (feature === "reach_p95_shoulder_width") {
    return numberOf(features, `skeleton_arm_${sideCode}_reach_p95_shoulder_width`);
  }
  if (feature === "task_endpoint_value_deg" || feature === "task_endpoint_excursion_deg") {
    const task = TASK_COLUMNS[exercise];
    if (!task) return Number.NaN;
    const suffix = feature === "task_endpoint_value_deg" ? task[0] : task[1];
    return numberOf(features, `skeleton_arm_${sideCode}_${suffix}`);
  }
  if (feature.startsWith("emg_")) {
    return numberOf(features, `emg_arm_${sideCode}_${feature.slice(4)}`);
  }
  if (feature.startsWith("imu_")) {
    return numberOf(features, `imu_arm_${sideCode}_${feature.slice(4)}`);
  }
  return Number.NaN;
}

function domainDeviations(
  exercise: string,
  features: Record<string, unknown>,
  reference: Record<string, ReferenceRule>
): Record<DomainName, number> | null {
  const sideScores: Array<Partial<Record<DomainName, number>>> = [];
  for (const [side, code] of [
    ["left", "l"],
    ["right", "r"],
  ] as const) {
    const scored: Partial<Record<DomainName, number>> = {};
    for (const domain of DOMAINS) {
      const values: number[] = [];
      for (const feature of DOMAIN_FEATURES[domain]) {
        const rule = reference[`${side}.${feature}`];
        if (!rule) continue;
        const raw = rawFeature(features, feature, code, exercise);
        const amount = deviation(raw, rule.center, rule.scale, rule.direction);
        if (Number.isFinite(amount)) values.push(amount);
      }
      if (values.length) {
        scored[domain] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }
    sideScores.push(scored);
  }

  const merged = {} as Record<DomainName, number>;
  for (const domain of DOMAINS) {
    const pair = sideScores
      .map((item) => item[domain])
      .filter((value): value is number => finite(value));
    if (!pair.length) return null;
    merged[domain] = pair.reduce((a, b) => a + b, 0) / pair.length;
  }
  return merged;
}

function parseDomains(body: Record<string, unknown>): Record<DomainName, number> | null {
  const source =
    (body.domains as Record<string, unknown> | undefined) ??
    (body as Record<string, unknown>);
  const merged = {} as Record<DomainName, number>;
  for (const name of DOMAINS) {
    const value = Number(source[name]);
    if (!Number.isFinite(value)) return null;
    merged[name] = value;
  }
  return merged;
}

function parseFeatures(body: Record<string, unknown>): Record<string, unknown> | null {
  const features = body.features;
  if (!features || typeof features !== "object" || Array.isArray(features)) return null;
  return features as Record<string, unknown>;
}

export type RiskScoreResult = {
  session_seq: string | null;
  exercise: string;
  sufficient: boolean;
  probability?: number;
  grade?: string;
  grade_label?: string;
  domains?: Record<DomainName, number>;
  source?: string;
  reason?: string;
};

export function scoreRiskPayload(body: Record<string, unknown>): RiskScoreResult {
  const exercise = String(body.exercise ?? "").trim();
  const sessionSeq =
    body.session_seq == null || body.session_seq === ""
      ? null
      : String(body.session_seq);

  if (!exercise) {
    return {
      session_seq: sessionSeq,
      exercise,
      sufficient: false,
      reason: "exercise가 필요합니다.",
    };
  }
  if (!model.exercises[exercise]) {
    return {
      session_seq: sessionSeq,
      exercise,
      sufficient: false,
      reason: "이 동작은 위험도 모델이 없습니다.",
    };
  }

  let domains = parseDomains(body);
  if (!domains) {
    const features = parseFeatures(body);
    const reference = model.exercises[exercise].reference;
    if (!features || !reference) {
      return {
        session_seq: sessionSeq,
        exercise,
        sufficient: false,
        reason: "domains 또는 features가 필요합니다.",
      };
    }
    domains = domainDeviations(exercise, features, reference);
    if (!domains) {
      return {
        session_seq: sessionSeq,
        exercise,
        sufficient: false,
        reason: "센서가 빠져 이 동작의 위험도를 계산하지 못했습니다.",
      };
    }
  }

  const scored = scoreExercise(exercise, domains);
  return {
    session_seq: sessionSeq,
    exercise,
    sufficient: true,
    probability: Number(scored.probability.toFixed(6)),
    grade: scored.grade,
    grade_label: scored.grade_label,
    domains: Object.fromEntries(
      DOMAINS.map((name) => [name, Number(domains[name].toFixed(6))])
    ) as Record<DomainName, number>,
    source: "render",
  };
}

export function hasExerciseModel(exercise: string): boolean {
  return Boolean(model.exercises[exercise]);
}
