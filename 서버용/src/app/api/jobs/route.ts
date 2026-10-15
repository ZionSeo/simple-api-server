import { NextResponse } from "next/server";
import { listJobs } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, jobs: listJobs() });
}
