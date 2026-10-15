import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    port: config.port,
    publicBaseUrl: config.publicBaseUrl,
    notifyUrl: `${config.publicBaseUrl}/api/calibration/complete`,
    hilBaseUrl: config.hilBaseUrl,
    hilMode: config.hilMode,
  });
}
