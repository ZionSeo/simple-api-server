import { NextRequest, NextResponse } from "next/server";
import { enqueueCalibrationJob } from "@/lib/jobs";
import { BODY_PARTS, KINDS, type BodyPart, type Kind } from "@/lib/types";

export const runtime = "nodejs";

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
