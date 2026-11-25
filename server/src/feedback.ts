import type { RiskScoreResult } from "./risk-score.js";

export type FeedbackPayload = {
  summary: string;
  points: string[];
};

export function buildFeedback(risk: RiskScoreResult): FeedbackPayload {
  if (!risk.sufficient || risk.probability == null) {
    return {
      summary: risk.reason || "이 동작의 위험도를 계산하지 못했습니다.",
      points: [],
    };
  }
  const summary =
    risk.grade === "low"
      ? "이 동작 기준 근감소 위험도는 낮은 편입니다."
      : risk.grade === "moderate"
        ? "이 동작 기준 근감소 위험도는 중간입니다."
        : "이 동작 기준 근감소 위험도가 높은 편입니다.";

  const domains = risk.domains;
  if (!domains) return { summary, points: [] };

  const ranked = (
    [
      ["가동", domains.movement_capacity, "어깨·팔꿈치 가동이나 도달이 정상보다 작습니다."],
      ["근활성", domains.muscle_activation, "근활성 패턴이 정상 범위와 다릅니다."],
      ["동작역학", domains.movement_dynamics, "움직임 속도·가속도 패턴이 정상과 다릅니다."],
      ["보상맥락", domains.compensation_context, "몸통·견갑 보상이 커 보입니다."],
    ] as Array<[string, number, string]>
  )
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1]);

  const points =
    ranked.length === 0
      ? ["· 네 영역 모두 정상 기준에서 나쁜 쪽 편차가 없습니다."]
      : ranked.slice(0, 2).map(([, , message]) => `· ${message}`);

  return { summary, points };
}
