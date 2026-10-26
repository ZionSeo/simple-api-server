# 서버 상시 유지 가이드 (학교 PC 기준)

## 결론부터

학교 PC에만 켜 두면 **퇴근·전원 OFF·로그아웃 시 서버도 꺼집니다.**  
퇴근 후에도 유지하려면 **학교 PC가 꺼져도 돌아가는 클라우드(무료 가능)**에 올려야 합니다.

| 방식 | 퇴근 후 유지 | 추천 |
|------|--------------|------|
| Cursor / Cloudflare 임시 터널 | ❌ | 개발용만 |
| 학교 PC + pm2 | ❌ (PC 끄면 종료) | 수업 중 테스트용 |
| **Render 무료 배포** | ✅ | **학교 PC에 추천** |
| 학교/랩 상시 서버(VPS) | ✅ | 있으면 좋음 |

---

## 추천: Render 무료로 상시 배포 (학교 PC 꺼도 유지)

1. [https://render.com](https://render.com) 가입 (GitHub 로그인 가능)
2. **New → Blueprint** 또는 **Web Service**
3. 이 저장소의 `서버용` 폴더를 연결  
   - Root Directory: `서버용`
4. 설정
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance: Free
5. 환경변수
   - `HIL_BASE_URL` = `http://221.162.67.121:91`
   - `HIL_MODE` = `auto` (실데이터만 쓰려면 `live`)
6. 배포 완료 후 나오는 주소 예:
   - `https://grip-analysis.onrender.com`
7. HIL에 이 URL 등록:

```http
POST https://grip-analysis.onrender.com/api/calibration/complete
Content-Type: application/json

{"individual_seq":15,"calibration_seq":101}
```

`render.yaml`이 이미 포함되어 있어 Blueprint로 한 번에 올릴 수 있습니다.

> Free 플랜은 한동안 트래픽이 없으면 잠들 수 있습니다.  
> 잠든 뒤 첫 요청은 수십 초 걸릴 수 있으니, 데모 전에는 한 번 `/api/health`를 열어두면 됩니다.

---

## (선택) 학교 PC를 끄지 않고 쓰는 경우

PC가 **밤새 켜져 있고** 절전되지 않을 때만 의미 있습니다.

```bash
cd 서버용
npm install
npm run build
npx pm2 start ecosystem.config.cjs
npx pm2 save
npx pm2 startup
```

Windows면 추가로:

- 설정 → 전원: 절전/화면 끄기 **안 함**
- 로그아웃/종료하면 서버도 끝남

공개 URL은 Cloudflare Named Tunnel 또는 학교 공인 IP가 필요합니다.  
보통 학교 방화벽 때문에 외부 공개가 막혀 있어, **Render가 더 쉽습니다.**

---

## Docker / VPS

학교·연구실에 항상 켜진 서버가 있으면:

```bash
cd 서버용
docker build -t grip-analysis .
docker run -d --name grip-analysis --restart unless-stopped \
  -p 3847:3847 \
  -e HIL_BASE_URL=http://221.162.67.121:91 \
  -e HIL_MODE=auto \
  -e PUBLIC_BASE_URL=https://<고정도메인> \
  -v $(pwd)/data:/app/data \
  grip-analysis
```

---

## HIL에 최종으로 줄 값

```http
POST https://<고정-공개-도메인>/api/calibration/complete
Content-Type: application/json

{"individual_seq":15,"calibration_seq":101}
```
