import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GROUP_DISPLAY, normalizeGroup, type CohortGroup } from "./cohort.js";
import { getDataDir } from "./store.js";

type FeatureName =
  | "movement_capacity_deviation_z"
  | "muscle_activation_deviation_z"
  | "movement_dynamics_deviation_z"
  | "compensation_context_deviation_z";

type LogisticModel = {
  label_positive: string;
  label_negative: string;
  positive_rule: string;
  features: FeatureName[];
  feature_names_ko: string[];
  mean: number[];
  scale: number[];
  coef: number[];
  intercept: number;
  threshold: number;
  preprocess: string;
};

type InitialSubject = {
  subject_id: string;
  institution: string;
  initial_group: CohortGroup;
  features: Record<FeatureName, number>;
  overall_deviation_z: number;
};

type Prediction = {
  probability: number;
  predicted: CohortGroup;
  predicted_label: string;
  matches_group: boolean;
};

type OverrideFile = {
  groups: Record<string, CohortGroup>;
  predictions: Record<string, Prediction>;
};

const dataDir = path.dirname(fileURLToPath(import.meta.url));

function readJson<T>(fileName: string): T {
  const file = path.join(dataDir, "..", "data", fileName);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const model = readJson<LogisticModel>("logistic-model.json");
const initialSubjects = readJson<InitialSubject[]>("initial-subjects.json");

function overridePath() {
  return path.join(path.dirname(getDataDir()), "reference-groups.json");
}

function loadOverrides(): OverrideFile {
  const file = overridePath();
  if (!fs.existsSync(file)) return { groups: {}, predictions: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as OverrideFile;
    return {
      groups: parsed.groups ?? {},
      predictions: parsed.predictions ?? {},
    };
  } catch {
    return { groups: {}, predictions: {} };
  }
}

function saveOverrides(overrides: OverrideFile) {
  const file = overridePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(overrides, null, 2), "utf8");
}

function sigmoid(value: number) {
  if (value >= 0) return 1 / (1 + Math.exp(-value));
  const exp = Math.exp(value);
  return exp / (1 + exp);
}

const INDICATOR_FORMULAS = {
  reference: [
    "기준 집단은 한동대 정상군입니다. 같은 운동, 같은 쪽(왼쪽 또는 오른쪽)끼리 중심과 척도를 구합니다.",
    "정상군 본인의 점수를 계산할 때는 그 사람을 기준에서 뺍니다. 근감소군은 정상군 전체 기준을 사용합니다.",
    "기준 인원이 8명 미만이거나 척도를 만들지 못하면 그 특징은 빠집니다.",
  ],
  scale: [
    "중심 = median(정상군 측정값)",
    "MAD = median(|측정값 - 중심|)",
    "척도 = 1.4826 × MAD",
    "척도가 0이면 척도 = (Q3 - Q1) / 1.349",
    "그래도 0이면 척도 = 표본 표준편차(자유도 1)",
  ],
  deviation: [
    "signed_z = (측정값 - 중심) / 척도",
    "작을수록 문제(low_bad): 편차 = max(-signed_z, 0)",
    "클수록 문제(high_bad): 편차 = max(signed_z, 0)",
    "양방향(two_sided): 편차 = |signed_z|",
    "편차는 5를 넘기면 5로 자릅니다. 단위는 무차원 robust z입니다.",
  ],
  aggregation: [
    "운동·한쪽의 영역값 = 그 영역에 속한 특징 편차의 중앙값",
    "한쪽 대표값 = 다섯 운동 영역값의 중앙값",
    "다섯 운동은 chest_press, shoulder_press, seated_row, arm_curl, overhead_triceps_extension입니다.",
    "사람 지표 = (왼쪽 대표값 + 오른쪽 대표값) / 2",
  ],
  indicators: [
    {
      name: "가동",
      key: "movement_capacity_deviation_z",
      direction: "low_bad",
      meaning: "정상보다 가동 범위나 도달량이 작을 때만 편차로 셉니다.",
      features: [
        "어깨 가동범위 shoulder_rom_deg (도)",
        "팔꿈치 가동범위 elbow_rom_deg (도)",
        "동작 끝 위치 task_endpoint_value_deg (도)",
        "동작 이동량 task_endpoint_excursion_deg (도)",
        "손 뻗기 95백분위 reach_p95_shoulder_width (어깨너비 배)",
      ],
      task: [
        "shoulder_press: 어깨 최대 굽힘, 어깨 양의 이동량",
        "arm_curl: 팔꿈치 굽힘량, 팔꿈치 굽힘 이동량",
        "overhead_triceps_extension: 팔꿈치 폄 끝 각도, 팔꿈치 폄 이동량",
        "chest_press: 팔꿈치 폄 끝 각도, 팔꿈치 폄 이동량",
        "seated_row: 팔꿈치 굽힘량, 팔꿈치 굽힘 이동량",
      ],
    },
    {
      name: "근활성",
      key: "muscle_activation_deviation_z",
      direction: "two_sided",
      meaning: "정상 중심보다 크거나 작은 근활성 모두 편차로 셉니다.",
      features: [
        "활성 비율 emg_active_fraction (0~1)",
        "RMS emg_rms_adc (ADC)",
        "초당 파형 길이 emg_waveform_length_per_s",
      ],
      task: [],
    },
    {
      name: "동작역학",
      key: "movement_dynamics_deviation_z",
      direction: "two_sided",
      meaning: "정상 중심보다 크거나 작은 움직임 모두 편차로 셉니다.",
      features: [
        "각속도 95백분위 imu_angular_speed_p95_deg_s (도/초)",
        "동적 가속도 RMS imu_acceleration_dynamic_rms",
        "동적 가속도 95백분위 imu_acceleration_dynamic_p95",
        "동적 가속도 사분위 범위 imu_acceleration_dynamic_iqr",
        "동적 가속도 왜도 imu_acceleration_dynamic_skewness (무차원)",
      ],
      task: [],
    },
    {
      name: "보상맥락",
      key: "compensation_context_deviation_z",
      direction: "high_bad",
      meaning: "정상보다 몸통이나 가슴의 보상 움직임이 클 때만 편차로 셉니다.",
      features: [
        "몸통 흔들림 skeleton_trunk_sway_rom_deg (도)",
        "견갑 기울기 skeleton_scapular_tilt_rom_deg (도)",
        "중심선 이동 skeleton_centerline_rom_shoulder_width (어깨너비 배)",
        "가슴 롤 imu_chest_roll_rom_deg (도)",
        "가슴 피치 imu_chest_pitch_rom_deg (도)",
      ],
      task: [],
    },
  ],
};

export function modelInfo() {
  return {
    threshold: model.threshold,
    intercept: model.intercept,
    features: model.features,
    feature_names_ko: model.feature_names_ko,
    mean: model.mean,
    scale: model.scale,
    coef: model.coef,
    positive_rule: model.positive_rule,
    preprocess: model.preprocess,
    formulas: {
      ...INDICATOR_FORMULAS,
      logistic: [
        "z = (사람 지표 - 학습 평균) / 학습 표준편차",
        `logit = ${model.intercept} + ${model.coef
          .map((coef, index) => `${coef}×${model.feature_names_ko[index]}z`)
          .join(" + ")}`,
        "근감소 확률 = 1 / (1 + exp(-logit))",
        `확률이 ${model.threshold} 이상이면 근감소, 미만이면 정상입니다.`,
      ],
    },
  };
}

export function scoreSubject(features: Record<FeatureName, number>) {
  let logit = model.intercept;
  model.features.forEach((name, index) => {
    const z = (features[name] - model.mean[index]) / model.scale[index];
    logit += z * model.coef[index];
  });
  const probability = sigmoid(logit);
  const predicted: CohortGroup = probability >= model.threshold ? "patient" : "control";
  return { logit, probability, predicted };
}

export function listReferenceSubjects() {
  const overrides = loadOverrides();
  return initialSubjects.map((person) => {
    const group = overrides.groups[person.subject_id] ?? person.initial_group;
    const prediction = overrides.predictions[person.subject_id] ?? null;
    return {
      ...person,
      group,
      group_label: GROUP_DISPLAY[group],
      initial_group_label: GROUP_DISPLAY[person.initial_group],
      adjusted: group !== person.initial_group,
      prediction,
    };
  });
}

export function setReferenceGroup(subjectId: string, group: CohortGroup) {
  const person = initialSubjects.find((item) => item.subject_id === subjectId);
  if (!person) throw new Error("초기 인원 목록에 없는 대상자입니다.");
  const overrides = loadOverrides();
  overrides.groups[subjectId] = group;
  delete overrides.predictions[subjectId];
  saveOverrides(overrides);
  return listReferenceSubjects().find((item) => item.subject_id === subjectId);
}

export function applyLogisticModel() {
  const overrides = loadOverrides();
  const subjects = listReferenceSubjects();
  const predictions: Record<string, Prediction> = {};
  const rows = subjects.map((person) => {
    const scored = scoreSubject(person.features);
    const prediction: Prediction = {
      probability: scored.probability,
      predicted: scored.predicted,
      predicted_label: GROUP_DISPLAY[scored.predicted],
      matches_group: scored.predicted === person.group,
    };
    predictions[person.subject_id] = prediction;
    return { ...person, prediction };
  });
  overrides.predictions = predictions;
  saveOverrides(overrides);
  const matched = rows.filter((row) => row.prediction.matches_group).length;
  return {
    ok: true,
    model: modelInfo(),
    summary: {
      n: rows.length,
      n_control: rows.filter((row) => row.group === "control").length,
      n_patient: rows.filter((row) => row.group === "patient").length,
      matched,
      accuracy: rows.length ? matched / rows.length : 0,
    },
    subjects: rows,
  };
}

export function referenceGroupFromBody(value: unknown) {
  return normalizeGroup(value);
}
