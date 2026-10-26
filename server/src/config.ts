function resolvePublicBaseUrl() {
  const candidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined,
    process.env.FLY_APP_NAME
      ? `https://${process.env.FLY_APP_NAME}.fly.dev`
      : undefined,
  ].filter(Boolean) as string[];

  return (candidates[0] || "http://127.0.0.1:3847").replace(/\/$/, "");
}

export const config = {
  port: Number(process.env.PORT) || 3847,
  hilBaseUrl: (process.env.HIL_BASE_URL || "http://221.162.67.121:91").replace(
    /\/$/,
    ""
  ),
  publicBaseUrl: resolvePublicBaseUrl(),
  // mock만 샘플을 반환합니다. auto는 예전 환경변수 호환용이며 live와 같이 HIL을 호출합니다.
  hilMode: (process.env.HIL_MODE || "live") as "auto" | "mock" | "live",
};
