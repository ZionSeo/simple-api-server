export const config = {
  port: Number(process.env.PORT) || 3847,
  hilBaseUrl: (process.env.HIL_BASE_URL || "http://221.162.67.121:91").replace(
    /\/$/,
    ""
  ),
  /** 외부에서 HIL이 호출할 공개 base URL (터널/배포 주소) */
  publicBaseUrl: (
    process.env.PUBLIC_BASE_URL ||
    "https://hearts-writers-satellite-submission.trycloudflare.com"
  ).replace(/\/$/, ""),
  /** true면 HIL 대신 mock 데이터 사용. auto면 실패 시 mock */
  hilMode: (process.env.HIL_MODE || "auto") as "auto" | "mock" | "live",
  dataDir: process.env.DATA_DIR || "",
};
