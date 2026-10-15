import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const job = getJob(id);
  if (!job) {
    return NextResponse.json(
      { ok: false, message: "job not found" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, job });
}
