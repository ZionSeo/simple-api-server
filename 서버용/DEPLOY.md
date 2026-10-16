# 서버 상시 유지 가이드

Cursor 클라우드 세션 / 임시 Cloudflare 터널은 **퇴근·세션 종료 시 꺼집니다.**  
HIL이 항상 알림을 보내려면 **항상 켜져 있는 PC/VPS/호스팅**에 배포해야 합니다.

## 추천 방식

### A. 회사 VPS / 상시 PC + pm2 (가장 단순)

```bash
cd 서버용
npm install
npm run build
npx pm2 start ecosystem.config.cjs
npx pm2 save
npx pm2 startup   # 재부팅 후에도 자동 실행
```

공개 주소가 필요하면:

- 공인 IP + 방화벽에서 `3847` 오픈, 또는
- reverse proxy(nginx) + 도메인 HTTPS, 또는
- `cloudflared tunnel` Named Tunnel(고정 도메인)

HIL 알림 URL 예:

```text
POST https://<고정도메인>/api/calibration/complete
```

### B. Docker (VPS/온프레미스)

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

### C. Railway / Render / Fly.io 같은 PaaS

1. 이 폴더를 GitHub에 연결
2. Web Service로 배포 (포트 `3847` 또는 플랫폼 기본 PORT)
3. 환경변수 설정:
   - `HIL_BASE_URL=http://221.162.67.121:91`
   - `HIL_MODE=auto` (또는 `live`)
   - `PUBLIC_BASE_URL=https://배포된-도메인`
4. 나온 HTTPS URL을 HIL 알림 주소로 등록

## 왜 Cursor에서는 안 되나

| 환경 | 계속 켜짐? | 고정 URL? |
|------|------------|-----------|
| Cursor 에이전트 + Quick Tunnel | ❌ 세션 종료 시 꺼짐 | ❌ 재시작마다 바뀜 |
| 회사 VPS + pm2/Docker | ✅ | ✅ (설정 시) |
| Railway/Render 등 | ✅ | ✅ |

## HIL에 알려줄 최종 값

배포 후 이 한 줄만 전달하면 됩니다.

```http
POST https://<고정-공개-도메인>/api/calibration/complete
Content-Type: application/json

{"individual_seq":15,"calibration_seq":101}
```
