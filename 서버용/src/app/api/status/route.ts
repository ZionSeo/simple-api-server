import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { listDatasets, listJobs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    port: config.port,
    publicBaseUrl: config.publicBaseUrl,
    notifyUrl: `${config.publicBaseUrl}/api/calibration/complete`,
    hilBaseUrl: config.hilBaseUrl,
    hilMode: config.hilMode,
    jobs: listJobs().slice(0, 50),
    datasets: listDatasets()
      .slice(0, 50)
      .map(({ filePath, ...rest }) => ({
        ...rest,
        fileName: filePath.split(/[\\/]/).pop(),
      })),
  });
}
