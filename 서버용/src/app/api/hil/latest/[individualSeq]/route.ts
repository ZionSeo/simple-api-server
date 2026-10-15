import { NextResponse } from "next/server";
import { fetchLatestCalibration } from "@/lib/hil-client";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ individualSeq: string }> }
) {
  const { individualSeq } = await context.params;
  const seq = Number(individualSeq);
  if (!Number.isFinite(seq)) {
    return NextResponse.json(
      { ok: false, message: "invalid individual_seq" },
      { status: 400 }
    );
  }

  try {
    const data = await fetchLatestCalibration(seq);
    return NextResponse.json(data);
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
