"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { BODY_PARTS, KINDS, type AnalysisJob, type BodyPart, type Kind } from "@/lib/types";

type DatasetRow = {
  id: string;
  jobId: string;
  individual_seq: number;
  calibration_seq: number;
  body_part: BodyPart;
  kind: Kind;
  byteSize: number;
  lineCount: number;
  source: "hil" | "mock";
  createdAt: string;
  fileName?: string;
};

type LatestInfo = {
  ok: boolean;
  individual_seq: number;
  calibration_seq: number;
  created_time: string;
  source?: string;
  body_parts: Array<{
    body_part: string;
    imu_count: number;
    emg_count: number;
  }>;
};

type PreviewState = {
  datasetId: string;
  totalLines: number;
  lines: Record<string, unknown>[];
} | null;

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function Dashboard() {
  const [individualSeq, setIndividualSeq] = useState("15");
  const [calibrationSeq, setCalibrationSeq] = useState("101");
  const [bodyPart, setBodyPart] = useState<BodyPart | "">("arm_r");
  const [kind, setKind] = useState<Kind | "">("imu");
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [latest, setLatest] = useState<LatestInfo | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [log, setLog] = useState("준비됨. HIL 연결이 안 되면 mock 데이터로 동작합니다.");
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<{
    hilBaseUrl: string;
    hilMode: string;
    publicBaseUrl?: string;
    notifyUrl?: string;
    port?: number;
  } | null>(null);

  const appendLog = useCallback((message: string) => {
    setLog((prev) => {
      const next = `${new Date().toLocaleTimeString()}  ${message}\n${prev}`;
      return next.length > 4000 ? next.slice(0, 4000) : next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    const res = await fetch("/api/status").then((r) => r.json());
    setJobs(res.jobs ?? []);
    setDatasets(res.datasets ?? []);
    setHealth({
      hilBaseUrl: res.hilBaseUrl,
      hilMode: res.hilMode,
      publicBaseUrl: res.publicBaseUrl,
      notifyUrl: res.notifyUrl,
      port: res.port,
    });
  }, []);

  useEffect(() => {
    void refresh();
    // 2.5초×3요청 → 8초×1요청으로 부하 감소. 탭 숨김 시 폴링 중단.
    const timer = setInterval(() => void refresh(), 8000);
    const onVis = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const statusColor = useMemo(
    () =>
      ({
        queued: "secondary",
        running: "outline",
        done: "default",
        failed: "destructive",
      }) as const,
    []
  );

  async function notifyComplete() {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      if (bodyPart) qs.set("body_part", bodyPart);
      if (kind) qs.set("kind", kind);
      const res = await fetch(`/api/calibration/complete?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          individual_seq: Number(individualSeq),
          calibration_seq: Number(calibrationSeq),
        }),
      });
      const json = await res.json();
      appendLog(`알림 응답: ${JSON.stringify(json)}`);
      await refresh();
    } catch (error) {
      appendLog(`알림 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function queryLatest() {
    setBusy(true);
    try {
      const res = await fetch(`/api/hil/latest/${Number(individualSeq)}`);
      const json = await res.json();
      setLatest(json);
      if (json.calibration_seq) {
        setCalibrationSeq(String(json.calibration_seq));
      }
      appendLog(
        `최신 캘리브레이션 조회 (${json.source ?? "?"}): calibration_seq=${json.calibration_seq}`
      );
    } catch (error) {
      appendLog(`조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadData() {
    if (!bodyPart || !kind) {
      appendLog("body_part와 kind를 선택하세요.");
      return;
    }
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        calibration_seq: String(Number(calibrationSeq)),
        body_part: bodyPart,
        kind,
      });
      const res = await fetch(`/api/hil/data?${qs.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const source = res.headers.get("X-Data-Source") || "?";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `calibration_${calibrationSeq}_${bodyPart}_${kind}.ndjson.gz`;
      a.click();
      URL.revokeObjectURL(url);
      appendLog(`다운로드 완료 (${source}, ${blob.size} bytes)`);
    } catch (error) {
      appendLog(`다운로드 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function previewDataset(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/datasets/${id}/preview?limit=20`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "preview failed");
      setPreview({
        datasetId: id,
        totalLines: json.totalLines,
        lines: json.lines,
      });
      appendLog(`미리보기: dataset ${id}, ${json.totalLines} lines`);
    } catch (error) {
      appendLog(`미리보기 실패: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium tracking-wide text-teal-800">Grip Analysis Server</p>
        <h1 className="font-serif text-3xl tracking-tight text-stone-900 md:text-4xl">
          악력 분석 서버 콘솔
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-600">
          HIL 저장 알림을 받고, calibration 데이터를 조회·다운로드한 뒤 ndjson.gz를 미리볼 수 있습니다.
        </p>
        {health && (
          <div className="flex flex-wrap gap-2 pt-1 text-xs text-stone-500">
            <Badge variant="outline">port {health.port ?? 3847}</Badge>
            <Badge variant="outline">공개 {health.publicBaseUrl}</Badge>
            <Badge variant="secondary">mode: {health.hilMode}</Badge>
            <Badge variant="outline">HIL {health.hilBaseUrl}</Badge>
          </div>
        )}
        {health?.notifyUrl && (
          <p className="rounded-lg border border-teal-700/20 bg-white/70 px-3 py-2 text-xs text-slate-700">
            HIL 알림 URL:{" "}
            <code className="break-all font-mono text-[11px]">{health.notifyUrl}</code>
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. 저장 완료 알림 시뮬레이션</CardTitle>
            <CardDescription>
              HIL → 분석서버 <code className="text-xs">POST /api/calibration/complete</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="individual">individual_seq</Label>
                <Input
                  id="individual"
                  value={individualSeq}
                  onChange={(e) => setIndividualSeq(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calibration">calibration_seq</Label>
                <Input
                  id="calibration"
                  value={calibrationSeq}
                  onChange={(e) => setCalibrationSeq(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="body">body_part</Label>
                <select
                  id="body"
                  className={selectClass}
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value as BodyPart | "")}
                >
                  <option value="">(자동: arm_r imu/emg)</option>
                  {BODY_PARTS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kind">kind</Label>
                <select
                  id="kind"
                  className={selectClass}
                  value={kind}
                  onChange={(e) => setKind(e.target.value as Kind | "")}
                >
                  <option value="">(미지정)</option>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button onClick={() => void notifyComplete()} disabled={busy}>
              알림 보내기 (200 즉시 응답)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. HIL 데이터 조회</CardTitle>
            <CardDescription>
              최신 calibration 조회 후 ndjson.gz 다운로드
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void queryLatest()} disabled={busy}>
                최신 calibration 조회
              </Button>
              <Button variant="secondary" onClick={() => void downloadData()} disabled={busy}>
                ndjson.gz 다운로드
              </Button>
            </div>
            {latest?.ok && (
              <div className="rounded-lg border bg-stone-50 p-3 text-sm">
                <p>
                  individual={latest.individual_seq} / calibration=
                  {latest.calibration_seq} / source={latest.source}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  body_parts:{" "}
                  {latest.body_parts
                    ?.map((b) => `${b.body_part}(imu:${b.imu_count},emg:${b.emg_count})`)
                    .join(", ")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>작업(Jobs)</CardTitle>
          <CardDescription>알림 수신 후 백그라운드 다운로드 상태</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상태</TableHead>
                <TableHead>individual</TableHead>
                <TableHead>calibration</TableHead>
                <TableHead>대상</TableHead>
                <TableHead>메시지</TableHead>
                <TableHead>시각</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    아직 작업이 없습니다. 알림을 보내보세요.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Badge variant={statusColor[job.status]}>{job.status}</Badge>
                    </TableCell>
                    <TableCell>{job.individual_seq}</TableCell>
                    <TableCell>{job.calibration_seq}</TableCell>
                    <TableCell className="text-xs">
                      {(job.body_part || "-") + "/" + (job.kind || "-")}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {job.message}
                      {job.error ? ` (${job.error})` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(job.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>저장된 데이터셋</CardTitle>
          <CardDescription>다운로드된 ndjson.gz 목록과 미리보기</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>calibration</TableHead>
                <TableHead>부위/종류</TableHead>
                <TableHead>lines</TableHead>
                <TableHead>size</TableHead>
                <TableHead>source</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {datasets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    저장된 데이터셋이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                datasets.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.calibration_seq}</TableCell>
                    <TableCell>
                      {d.body_part}/{d.kind}
                    </TableCell>
                    <TableCell>{d.lineCount}</TableCell>
                    <TableCell>{d.byteSize} B</TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.source}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void previewDataset(d.id)}
                        disabled={busy}
                      >
                        미리보기
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {preview && (
            <div className="space-y-2">
              <p className="text-sm text-stone-600">
                dataset {preview.datasetId} · 전체 {preview.totalLines}줄 중 일부
              </p>
              <Textarea
                className="min-h-48 font-mono text-xs"
                readOnly
                value={preview.lines.map((line) => JSON.stringify(line)).join("\n")}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>로그</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea className="min-h-36 font-mono text-xs" readOnly value={log} />
        </CardContent>
      </Card>
    </div>
  );
}
