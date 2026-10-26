# 악력 분석 서버 API 사양 (HIL 연동용)

## 접속 정보

| 항목 | 값 |
|------|-----|
| 공개 도메인 (임시 터널) | `https://office-treo-networking-disks.trycloudflare.com` |
| 프로토콜 | HTTPS |
| 공개 포트 | **443** (HTTPS 기본, 별도 포트 지정 불필요) |
| 내부 리슨 포트 | `3847` (`0.0.0.0`) |
| Content-Type | `application/json` (알림 API) |

> ⚠️ Quick Tunnel은 **만료되면 `ENOTFOUND`** 가 납니다.  
> Postman/HIL용 **고정 주소**는 [`FIXED_URL.md`](./FIXED_URL.md) 의 Render 배포를 사용하세요.

콘솔 UI: https://office-treo-networking-disks.trycloudflare.com/

---

## 1. 캘리브레이션 저장 완료 알림 (HIL → 분석서버)

HIL이 데이터 저장 후 호출하는 엔드포인트입니다.  
분석서버는 **즉시 200**을 주고, 이후 HIL에서 `ndjson.gz`를 조회합니다.

### Request

- **Method:** `POST`
- **URL:** `https://office-treo-networking-disks.trycloudflare.com/api/calibration/complete`
- **Headers:** `Content-Type: application/json`

**Body**

```json
{
  "individual_seq": 15,
  "calibration_seq": 101
}
```

**Query (필수)**

| 파라미터 | 필수 | 예시 | 설명 |
|----------|------|------|------|
| `body_part` | Y | `arm_r` | `arm_r` / `arm_l` / `leg_r` / `leg_l` / `head` / `chest` |
| `kind` | Y | `imu` | `imu` / `emg` |

`calibration_seq`는 경로(`/api/calibration/complete/{calibration_seq}`) 또는 본문에 둡니다. 둘 다 있으면 값이 같아야 합니다. 쿼리가 빠지거나 허용 값이 아니면 400을 반환하고 작업을 만들지 않습니다.

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
curl -X POST "https://office-treo-networking-disks.trycloudflare.com/api/calibration/complete?body_part=arm_r&kind=imu" \
  -H "Content-Type: application/json" \
  -d '{"individual_seq":15,"calibration_seq":101}'
```

경로로 `calibration_seq`를 주는 경우:

```bash
curl -X POST "https://office-treo-networking-disks.trycloudflare.com/api/calibration/complete/101?body_part=arm_r&kind=imu" \
  -H "Content-Type: application/json" \
  -d '{"individual_seq":15}'
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

Base: `https://office-treo-networking-disks.trycloudflare.com`

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
| `GET` | `/api/subjects` | 대상자 분류와 학습 예제 |
| `POST` | `/api/subjects/{individual_seq}/group` | body `group`: `정상` 또는 `근감소` |
| `POST` | `/api/subjects/{individual_seq}/grip` | HIL 최신 calibration의 부위·종류 파일을 모두 저장 |
| `POST` | `/api/subjects/{individual_seq}/motion` | body `session_seq`. HIL `GET /export/all/{session_seq}` |
| `POST` | `/api/subjects/{individual_seq}/training` | body `session_seq`. 분류된 악력+동작 한 건을 학습 예제로 저장 |

분류와 학습 예제는 `data/cohort.json`에 남습니다. 정상 label은 0, 근감소 label은 1입니다. HIL 알림 응답에는 분류를 넣지 않습니다.

---

## 연동 체크리스트 (HIL 담당자)

1. 알림 URL을 아래로 설정  
   `POST https://office-treo-networking-disks.trycloudflare.com/api/calibration/complete`
2. Body에 `individual_seq`, `calibration_seq` 포함
3. 응답 `200` + `"ok": true` 확인
4. 분석서버 콘솔 UI / `GET /api/jobs` 에서 `done` 상태 확인
