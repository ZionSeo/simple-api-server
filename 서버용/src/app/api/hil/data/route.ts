import { NextRequest, NextResponse } from "next/server";
import { downloadCalibrationData } from "@/lib/hil-client";
import { BODY_PARTS, KINDS, type BodyPart, type Kind } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const calibration_seq = Number(req.nextUrl.searchParams.get("calibration_seq"));
  const body_part = req.nextUrl.searchParams.get("body_part") as BodyPart | null;
  const kind = req.nextUrl.searchParams.get("kind") as Kind | null;

  if (
    !Number.isFinite(calibration_seq) ||
    !body_part ||
    !kind ||
    !(BODY_PARTS as readonly string[]).includes(body_part) ||
    !(KINDS as readonly string[]).includes(kind)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "calibration_seq, body_part(arm_r|...), kind(imu|emg)가 필요합니다.",
      },
      { status: 400 }
    );
  }

  try {
    const downloaded = await downloadCalibrationData({
      calibration_seq,
      body_part,
      kind,
    });
    return new NextResponse(new Uint8Array(downloaded.buffer), {
      status: 200,
      headers: {
        "Content-Type": downloaded.contentType,
        "Content-Disposition": `attachment; filename="calibration_${calibration_seq}_${body_part}_${kind}.ndjson.gz"`,
        "X-Data-Source": downloaded.source,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
