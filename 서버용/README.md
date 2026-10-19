# 악력 분석 서버 (경량)

Express 기반 경량 API + 백그라운드 워커 + 얇은 HTML 모니터입니다.  
Next.js를 제거해 상시 메모리 사용을 크게 줄였습니다.

## 구조

```
HIL --POST--> /api/calibration/complete  (즉시 200)
                 └─ 워커: 다운로드 → 스트림 분석 → 결과 저장
모니터 UI  (/)  ← /api/status
```

## 실행

```bash
cd 서버용
npm install
npm start
```

주소: `http://127.0.0.1:3847`

## HIL 알림

```bash
curl -X POST http://127.0.0.1:3847/api/calibration/complete \
  -H "Content-Type: application/json" \
  -d '{"individual_seq":15,"calibration_seq":101}'
```

## 환경변수

| 변수 | 기본 | 설명 |
|------|------|------|
| `PORT` | `3847` | 리슨 포트 |
| `HIL_BASE_URL` | `http://221.162.67.121:91` | HIL 서버 |
| `HIL_MODE` | `auto` | `auto` / `mock` / `live` |
| `PUBLIC_BASE_URL` | (자동) | 외부 공개 주소 |

고정 URL: [`FIXED_URL.md`](./FIXED_URL.md)  
API 사양: [`API_SPEC.md`](./API_SPEC.md)
