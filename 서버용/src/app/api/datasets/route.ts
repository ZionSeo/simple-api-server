import { NextResponse } from "next/server";
import { listDatasets } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    datasets: listDatasets().map(({ filePath, ...rest }) => ({
      ...rest,
      // UI에는 절대 경로 대신 파일명만
      fileName: filePath.split(/[\\/]/).pop(),
    })),
  });
}
