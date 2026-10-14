const express = require("express");

const app = express();

// --- 수정 가능 설정 ---
const PORT = Number(process.env.PORT) || 3847;
const API_PATH = "/api/test";
const SUCCESS_RESPONSE = { ok: true, message: "success" };
// ---------------------

app.use(express.json());

app.post(API_PATH, (req, res) => {
  // 요청 본문은 별도 처리하지 않고 고정 응답만 반환
  res.json(SUCCESS_RESPONSE);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://127.0.0.1:${PORT}`);
  console.log(`POST ${API_PATH} → ${JSON.stringify(SUCCESS_RESPONSE)}`);
});
