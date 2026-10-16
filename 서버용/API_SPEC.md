# 악력 분석 서버 API 사양 (HIL 연동용)

## 접속 정보

| 항목 | 값 |
|------|-----|
| 공개 도메인 (현재 터널) | `https://howto-paso-attribute-spies.trycloudflare.com` |
| 프로토콜 | HTTPS |
| 공개 포트 | **443** (HTTPS 기본, 별도 포트 지정 불필요) |
| 내부 리슨 포트 | `3847` (`0.0.0.0`) |
| Content-Type | `application/json` (알림 API) |

> Cloudflare Quick Tunnel 주소는 **터널을 재시작하면 변경**될 수 있습니다.  
> 고정 도메인이 필요하면 별도 배포(VPS/Railway 등) 또는 Named Tunnel이 필요합니다.

콘솔 UI: https://howto-paso-attribute-spies.trycloudflare.com/

---

## 1. 캘리브레이션 저장 완료 알림 (HIL → 분석서버)

HIL이 데이터 저장 후 호출하는 엔드포인트입니다.  
분석서버는 **즉시 200**을 주고, 이후 HIL에서 `ndjson.gz`를 조회합니다.

### Request

- **Method:** `POST`
- **URL:** `https://howto-paso-attribute-spies.trycloudflare.com/api/calibration/complete`
- **Headers:** `Content-Type: application/json`

**Body**

```json
{
  "individual_seq": 15,
  "calibration_seq": 101
}
```

**Query (선택)**

| 파라미터 | 필수 | 예시 | 설명 |
|----------|------|------|------|
| `body_part` | N | `arm_r` | `arm_r` / `arm_l` / `leg_r` / `leg_l` / `chest` / `head` |
| `kind` | N | `imu` | `imu` / `emg` |

미지정 시 기본으로 `arm_r`의 `imu` + `emg`를 다운로드합니다.

### Response (성공)

- **HTTP 200**

```json
{
  "ok": true,
  "response": "success",
  "calibration_seq": 101,
  "job_id": "uuid"
}
```

### curl 예시

```bash
curl -X POST "https://howto-paso-attribute-spies.trycloudflare.com/api/calibration/complete" \
  -H "Content-Type: application/json" \
  -d '{"individual_seq":15,"calibration_seq":101}'
```

부위/종류 지정:

```bash
curl -X POST "https://howto-paso-attribute-spies.trycloudflare.com/api/calibration/complete?body_part=arm_r&kind=imu" \
  -H "Content-Type: application/json" \
  -d '{"individual_seq":15,"calibration_seq":101}'
```

---

## 2. (참고) 분석서버가 HIL로 조회하는 API

분석서버가 알림 수신 후 호출합니다. HIL 쪽 사양입니다.

| 용도 | Method | HIL URL |
|------|--------|---------|
| 최신 calibration | `GET` | `http://221.162.67.121:91/calibration/latest/{individual_seq}` |
| raw 다운로드 | `GET` | `http://221.162.67.121:91/calibration/{calibration_seq}/data?body_part=arm_r&kind=imu` |

응답: `ndjson.gz` 파일

---

## 3. 분석서버 보조 API

Base: `https://howto-paso-attribute-spies.trycloudflare.com`

| Method | Path | 설명 |
|--------|------|------|
| `GET` | `/api/health` | 서버/HIL 설정 상태 |
| `GET` | `/api/jobs` | 알림 후 처리 작업 목록 |
| `GET` | `/api/jobs/{id}` | 작업 상세 |
| `GET` | `/api/datasets` | 다운로드된 데이터셋 목록 |
| `GET` | `/api/datasets/{id}/preview` | ndjson 미리보기 |
| `GET` | `/api/hil/latest/{individual_seq}` | HIL 최신 calibration 프록시 |
| `GET` | `/api/hil/data?calibration_seq=&body_part=&kind=` | HIL raw 다운로드 프록시 |
| `GET/POST` | `/api/test` | 통신 테스트 `{ "ok": true, "message": "success" }` |

---

## 연동 체크리스트 (HIL 담당자)

1. 알림 URL을 아래로 설정  
   `POST https://howto-paso-attribute-spies.trycloudflare.com/api/calibration/complete`
2. Body에 `individual_seq`, `calibration_seq` 포함
3. 응답 `200` + `"ok": true` 확인
4. 분석서버 콘솔 UI / `GET /api/jobs` 에서 `done` 상태 확인
