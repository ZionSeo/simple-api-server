# 악력 분석 서버 (AI Analysis Server)

HIL 서버의 캘리브레이션 저장 알림을 받고, raw `ndjson.gz`를 조회·저장·미리보는 분석 서버입니다.

## 실행

```bash
cd 서버용
npm install
npm run dev
```

- 로컬: [http://127.0.0.1:3847](http://127.0.0.1:3847)
- 외부(현재 터널): [https://hearts-writers-satellite-submission.trycloudflare.com](https://hearts-writers-satellite-submission.trycloudflare.com)

HIL 연동 API 사양: [`API_SPEC.md`](./API_SPEC.md)  
서버 상시 유지(퇴근 후에도 유지): [`DEPLOY.md`](./DEPLOY.md)

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `HIL_BASE_URL` | `http://221.162.67.121:91` | HIL 서버 주소 |
| `HIL_MODE` | `auto` | `auto`(실패 시 mock) / `mock` / `live` |

## 우리 서버 API

### 1) 저장 완료 알림 (HIL → 분석서버)

`POST /api/calibration/complete`

```json
{ "individual_seq": 15, "calibration_seq": 101 }
```

Query(선택): `body_part`, `kind`

응답(즉시 200):

```json
{ "ok": true, "response": "success", "calibration_seq": 101, "job_id": "..." }
```

이후 백그라운드에서 HIL 데이터를 다운로드합니다.

### 2) HIL 프록시 조회

- `GET /api/hil/latest/{individual_seq}`
- `GET /api/hil/data?calibration_seq=101&body_part=arm_r&kind=imu`

### 3) 작업/데이터셋

- `GET /api/jobs`
- `GET /api/datasets`
- `GET /api/datasets/{id}/preview`

## UI

브라우저에서 콘솔을 열면 알림 시뮬레이션, 최신 calibration 조회, ndjson.gz 다운로드/미리보기가 가능합니다.
