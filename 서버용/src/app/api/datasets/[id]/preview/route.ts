import { NextRequest, NextResponse } from "next/server";
import { parseNdjsonGz } from "@/lib/ndjson";
import { getDataset } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const dataset = getDataset(id);
  if (!dataset) {
    return NextResponse.json(
      { ok: false, message: "dataset not found" },
      { status: 404 }
    );
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") || 30);
  try {
    const preview = await parseNdjsonGz(
      dataset.filePath,
      Number.isFinite(limit) ? limit : 30
    );
    return NextResponse.json({
      ok: true,
      dataset: {
        id: dataset.id,
        individual_seq: dataset.individual_seq,
        calibration_seq: dataset.calibration_seq,
        body_part: dataset.body_part,
        kind: dataset.kind,
        lineCount: dataset.lineCount,
        byteSize: dataset.byteSize,
        source: dataset.source,
      },
      totalLines: preview.totalLines,
      lines: preview.lines,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
