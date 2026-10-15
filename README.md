# 악력 분석 / 테스트 서버

`서버용` 폴더의 Next.js 앱이 AI 분석 서버 역할입니다.

- HIL 저장 완료 알림 수신: `POST /api/calibration/complete`
- HIL raw 데이터 조회/다운로드 UI 포함
- HIL 연결 실패 시 mock `ndjson.gz`로 로컬 테스트 가능

```bash
cd 서버용
npm install
npm run dev
```

자세한 내용은 [`서버용/README.md`](./서버용/README.md)를 참고하세요.
