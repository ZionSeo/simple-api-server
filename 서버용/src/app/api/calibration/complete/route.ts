import { NextRequest, NextResponse } from "next/server";
import { enqueueCalibrationJob } from "@/lib/jobs";
import { BODY_PARTS, KINDS, type BodyPart, type Kind } from "@/lib/types";

export const runtime = "nodejs";

/** 브라우저 주소창(GET)으로 열면 안내 JSON을 반환합니다. 실제 알림은 POST만 사용합니다. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      "이 URL은 POST 전용입니다. 브라우저로 열면 405가 날 수 있어, GET으로는 안내만 반환합니다.",
    method: "POST",
    path: "/api/calibration/complete",
    body_example: {
      individual_seq: 15,
      calibration_seq: 101,
    },
    curl: 'curl -X POST "<이주소>" -H "Content-Type: application/json" -d \'{"individual_seq":15,"calibration_seq":101}\'',
  });
}

function parseBodyPart(value: string | null): BodyPart | undefined {
  if (!value) return undefined;
  return (BODY_PARTS as readonly string[]).includes(value)
    ? (value as BodyPart)
    : undefined;
}

function parseKind(value: string | null): Kind | undefined {
  if (!value) return undefined;
  return (KINDS as readonly string[]).includes(value)
    ? (value as Kind)
    : undefined;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const individual_seq = Number(
    body.individual_seq ?? req.nextUrl.searchParams.get("individual_seq")
  );
  const calibration_seq = Number(
    body.calibration_seq ??
      req.nextUrl.searchParams.get("calibration_seq") ??
      req.nextUrl.pathname.split("/").pop()
  );

  if (!Number.isFinite(individual_seq) || !Number.isFinite(calibration_seq)) {
    return NextResponse.json(
      {
        ok: false,
        response: "invalid_request",
        message: "individual_seq와 calibration_seq가 필요합니다.",
      },
      { status: 400 }
    );
  }

  const body_part =
    parseBodyPart(String(body.body_part ?? "")) ??
    parseBodyPart(req.nextUrl.searchParams.get("body_part"));
  const kind =
    parseKind(String(body.kind ?? "")) ??
    parseKind(req.nextUrl.searchParams.get("kind"));

  const job = enqueueCalibrationJob({
    individual_seq,
    calibration_seq,
    body_part,
    kind,
  });

  // 프로토콜: 즉시 200 응답 후 백그라운드에서 HIL 조회
  return NextResponse.json({
    ok: true,
    response: "success",
    calibration_seq,
    job_id: job.id,
  });
}
