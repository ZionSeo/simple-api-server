const express = require("express");

const app = express();

// --- 수정 가능 설정 ---
const PORT = Number(process.env.PORT) || 3847;
const API_PATH = "/api/test";
const SUCCESS_RESPONSE = { ok: true, message: "success" };
// ---------------------

app.use(express.json());

// 브라우저에서 주소창으로 열어도 확인 가능하도록 GET도 동일 응답
app.get(API_PATH, (_req, res) => {
  res.json(SUCCESS_RESPONSE);
});

app.post(API_PATH, (_req, res) => {
  // 요청 본문은 별도 처리하지 않고 고정 응답만 반환
  res.json(SUCCESS_RESPONSE);
});

app.get("/", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>테스트 API 서버</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f2f2f2; padding: 0.15em 0.4em; border-radius: 4px; }
    pre { background: #f2f2f2; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    a { color: #0b57d0; }
  </style>
</head>
<body>
  <h1>테스트 API 서버</h1>
  <p>서버가 정상 실행 중입니다.</p>
  <p>API: <a href="${API_PATH}"><code>GET/POST ${API_PATH}</code></a></p>
  <p>응답 예:</p>
  <pre>${JSON.stringify(SUCCESS_RESPONSE)}</pre>
</body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://127.0.0.1:${PORT}`);
  console.log(`GET/POST ${API_PATH} → ${JSON.stringify(SUCCESS_RESPONSE)}`);
});
