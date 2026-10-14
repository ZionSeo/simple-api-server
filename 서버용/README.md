# 서버용 — 테스트 API

요청을 받으면 고정 JSON을 그대로 반환하는 간단한 테스트 API입니다. 요청 본문은 처리하지 않습니다.
브라우저에서 열어 확인할 수 있도록 `GET`과 `POST` 모두 지원합니다.

## 실행

```bash
cd 서버용
npm install
npm start
```

기본 주소: `http://127.0.0.1:3847`

## API

| 항목 | 값 |
|------|-----|
| Method | `GET` 또는 `POST` |
| URL | `/api/test` |
| Request 예 (POST) | `{"message":"test"}` |
| Response | `{"ok":true,"message":"success"}` |

브라우저에서 `http://127.0.0.1:3847/` 또는 `http://127.0.0.1:3847/api/test` 를 열면 바로 확인할 수 있습니다.

### curl 예시

```bash
curl -X POST http://127.0.0.1:3847/api/test \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

## 외부에서 접속 테스트

1. 터미널 1: `npm start`
2. 터미널 2에서 아래 한 줄만 실행:

```bash
npx --yes cloudflared tunnel --url http://127.0.0.1:3847
```

3. 출력에 나오는 `https://….trycloudflare.com` 주소를 다른 기기 브라우저에서 열고 뒤에 `/api/test`를 붙입니다.

예: `https://xxxx.trycloudflare.com/api/test` → `{"ok":true,"message":"success"}`

가입/설정 없이 바로 됩니다. 터미널을 닫으면 외부 주소는 사라집니다.

## 수정 방법

`server.js` 상단의 설정만 바꾸면 됩니다.

- `PORT` — 포트
- `API_PATH` — URL 경로
- `SUCCESS_RESPONSE` — 응답 JSON
