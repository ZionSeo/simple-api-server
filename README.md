# 테스트 API 서버

바탕화면의 **서버용** 폴더에 있는 간단한 POST 테스트 API입니다.

자세한 실행 방법은 [`서버용/README.md`](./서버용/README.md)를 참고하세요.

```bash
cd 서버용
npm install
npm start
```

- **POST** `/api/test`
- Request: `{"message":"test"}`
- Response: `{"ok":true,"message":"success"}`
