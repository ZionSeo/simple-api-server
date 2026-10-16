# 고정 주소(Permanent URL) 만들기

## 왜 지금 주소는 바뀌나

`*.trycloudflare.com` 은 **임시 터널**입니다.  
끄거나 세션이 끝나면 DNS가 사라져 Postman에서 `ENOTFOUND`가 납니다.

고정 주소가 필요하면 **Render 같은 상시 호스팅**에 배포해야 합니다.

## 추천: Render 무료 (고정 `*.onrender.com`)

배포 후 예시:

```text
모니터링 UI:
https://grip-analysis.onrender.com/

HIL / Postman:
POST https://grip-analysis.onrender.com/api/calibration/complete
Content-Type: application/json

{"individual_seq":15,"calibration_seq":101}
```

### 절차 (약 10분)

1. GitHub에 이 프로젝트를 올립니다. (Cursor에서 Create repo 후 push, 또는 GitHub 새 저장소)
2. [https://render.com](https://render.com) 가입 (GitHub 로그인)
3. **New → Blueprint** (또는 Web Service)
4. 저장소 선택  
   - Blueprint면 루트의 `render.yaml`이 자동 적용됩니다  
   - Web Service면 Root Directory를 `서버용`으로 설정
5. Create Web Service → 배포 완료까지 대기
6. Dashboard에 나온 URL을 복사해 HIL/Postman에 등록
7. (선택) Environment에  
   `PUBLIC_BASE_URL=https://grip-analysis.onrender.com`  
   를 넣으면 콘솔에도 같은 주소가 표시됩니다.  
   (`RENDER_EXTERNAL_URL`은 Render가 자동 주입하기도 합니다.)

### 참고

- Free 플랜은 한동안 요청이 없으면 sleep 될 수 있습니다.  
  잠들면 첫 요청이 20~60초 걸릴 수 있습니다.
- sleep이 싫으면 Render paid 또는 학교/연구실 VPS + 고정 도메인을 쓰면 됩니다.

## 임시 터널 vs 고정 주소

| | Cloudflare Quick Tunnel | Render |
|--|-------------------------|--------|
| 주소 | 매번 바뀜 | 고정 |
| 퇴근 후 | 끊김 | 유지 |
| Postman ENOTFOUND | 만료 시 발생 | 없음 |
