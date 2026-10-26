# 고정 주소 만들기 — 순서대로 (Render)

목표: `https://xxxx.onrender.com` 처럼 **안 바뀌는 주소**를 만들고  
HIL/Postman이 그 주소로 알림을 보내게 합니다.

가입만 끝난 상태 기준으로 **1 → 7** 순서로 진행하세요.

---

## 0. 준비물

- Render 계정 (가입 완료)
- GitHub 계정
- 이 프로젝트 코드 (`서버용` 폴더 포함)

---

## 1. GitHub에 코드 올리기

Render는 GitHub(또는 GitLab) 저장소에서 코드를 가져옵니다.  
지금 Cursor Origin만 있으면 Render가 연결되지 않으니 **GitHub 저장소가 필요합니다.**

### 방법 A) Cursor에서 Create repo (권장)

1. Cursor 화면에서 **Create repo** / 저장소 만들기 버튼을 누릅니다.
2. GitHub 계정 연결을 요청하면 허용합니다.
3. 저장소 이름 예: `grip-analysis`
4. **Public** 또는 **Private** 선택 후 생성합니다.
5. 생성이 끝나면 이 프로젝트 `main` 브랜치가 GitHub에 push됩니다.

### 방법 B) GitHub 웹에서 직접

1. [https://github.com/new](https://github.com/new) 접속
2. Repository name: `grip-analysis`
3. **Add a README** 체크 해제 (이미 코드가 있으므로)
4. **Create repository**
5. 로컬/Cursor 터미널에서 GitHub remote를 추가하고 push  
   (Cursor Create repo를 쓰면 이 과정이 자동인 경우가 많습니다.)

### 확인

브라우저에서 아래처럼 열리면 성공입니다.

```text
https://github.com/<내아이디>/grip-analysis
```

폴더 안에 `서버용/`, 루트에 `render.yaml`이 보여야 합니다.

---

## 2. Render에 GitHub 연결

1. [https://dashboard.render.com](https://dashboard.render.com) 로그인
2. 왼쪽 또는 상단 **New +** 클릭
3. 처음이면 **Connect GitHub** / **Configure account** 안내가 뜹니다
4. GitHub 권한 허용
5. **All repositories** 또는 방금 만든 `grip-analysis`만 선택
6. Save

---

## 3. 서비스 만들기 (두 가지 중 하나)

### 방법 1) Blueprint (가장 쉬움)

1. Dashboard → **New +** → **Blueprint**
2. GitHub 저장소 `grip-analysis` 선택
3. Render가 루트 `render.yaml`을 읽습니다  
   - `rootDir: 서버용`  
   - `buildCommand: npm install`  
   - `startCommand: npm start`
4. **Apply** / **Create** 클릭

### 방법 2) Web Service (수동)

1. Dashboard → **New +** → **Web Service**
2. 저장소 `grip-analysis` 선택 → **Connect**
3. 설정값 입력:

| 항목 | 값 |
|------|-----|
| Name | `grip-analysis` |
| Region | Singapore (또는 가까운 지역) |
| Root Directory | `서버용` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | **Free** |

4. **Create Web Service** 클릭

---

## 4. 환경변수 확인

서비스 페이지 → **Environment** 탭:

| Key | Value |
|-----|--------|
| `HIL_BASE_URL` | `http://221.162.67.121:91` |
| `HIL_MODE` | `auto` |
| `NODE_VERSION` | `22` |

선택:

| Key | Value |
|-----|--------|
| `PUBLIC_BASE_URL` | 배포 후 나온 `https://grip-analysis.onrender.com` |

저장 후 재배포되면 적용됩니다.

---

## 5. 배포 완료 기다리기

1. 서비스 화면 **Logs** / **Events** 탭을 엽니다
2. `npm install` → `npm start` → listening 관련 로그가 보이면 성공
3. 상태가 **Live** 가 될 때까지 기다립니다 (보통 2~5분, 첫 배포는 더 걸릴 수 있음)

실패 시 자주 있는 원인:
- Root Directory를 `서버용`으로 안 넣음
- Build/Start 명령이 다름
- GitHub 저장소에 최신 코드가 없음

---

## 6. 고정 주소 확인

서비스 상단에 주소가 보입니다. 예:

```text
https://grip-analysis.onrender.com
```

### 브라우저 테스트

1. 모니터 UI:  
   `https://grip-analysis.onrender.com/`
2. health:  
   `https://grip-analysis.onrender.com/api/health`  
   → `{"status":"ok", ...}` 나오면 정상

### Postman 테스트

1. Method: **POST**
2. URL: `https://grip-analysis.onrender.com/api/calibration/complete`
3. Headers: `Content-Type` = `application/json`
4. Body (raw JSON):

```json
{
  "individual_seq": 15,
  "calibration_seq": 101
}
```

5. Send  
   → `{"ok":true,"response":"success","calibration_seq":101,"job_id":"..."}` 이면 성공

> 브라우저 주소창에 API URL만 치면 GET이라 안내 JSON만 보입니다.  
> 실제 알림은 **반드시 POST**입니다.

---

## 7. HIL에 등록

HIL 담당/설정에 아래를 전달합니다.

```http
POST https://grip-analysis.onrender.com/api/calibration/complete
Content-Type: application/json

{"individual_seq":15,"calibration_seq":101}
```

이제 주소가 바뀌지 않습니다. (`ENOTFOUND` 나던 trycloudflare 임시 주소와 다름)

---

## 참고: Free 플랜 주의

- 한동안 요청이 없으면 서비스가 **잠들 수** 있습니다
- 잠든 뒤 첫 요청은 20~60초 걸릴 수 있습니다
- 데모 전에는 먼저 `/api/health`를 한 번 열어두면 좋습니다

---

## 체크리스트

- [ ] GitHub에 `grip-analysis` 저장소 있음
- [ ] Render ↔ GitHub 연결됨
- [ ] Web Service/Blueprint 생성, Root Directory=`서버용`
- [ ] 상태 Live
- [ ] `/` 콘솔 열림
- [ ] Postman POST 성공
- [ ] HIL에 고정 URL 전달
