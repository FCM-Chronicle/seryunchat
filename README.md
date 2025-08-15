# 세륜 채팅방 🌃

실시간 채팅 웹 애플리케이션입니다. Socket.IO를 사용하여 실시간 메시징, 사용자 관리, 멘션 기능을 제공합니다.

## ✨ 주요 기능

- 🚀 **실시간 메시징**: Socket.IO 기반 즉시 메시지 전송
- 👥 **온라인 사용자 목록**: 실시간 접속자 확인
- 🎨 **인스타그램 스타일 UI**: 모던하고 반응형 디자인
- 💬 **멘션 기능**: @사용자명으로 특정 사용자 호출
- ⚡ **타이핑 인디케이터**: 상대방 입력 상태 표시
- 🛡️ **관리자 기능**: 사용자 정지 및 강퇴 기능
- 📱 **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express.js
- **실시간 통신**: Socket.IO
- **스타일링**: 인스타그램 스타일 CSS, 그라디언트 애니메이션

## 🚀 배포

이 애플리케이션은 [Render](https://render.com)에서 호스팅됩니다.

### 로컬 개발환경 설정

1. 레포지토리 클론
```bash
git clone https://github.com/YOUR_USERNAME/seoul-chat-app.git
cd seoul-chat-app
```

2. 의존성 설치
```bash
npm install
```

3. 개발 서버 실행
```bash
npm run dev
```

4. 브라우저에서 `http://localhost:3000` 접속

## 📋 사용법

1. 웹사이트 접속 후 사용자 이름 입력
2. 채팅방 입장 후 실시간 대화 참여
3. `@사용자명`으로 멘션 기능 사용
4. 관리자는 `/정지 [사용자명] [초]` 또는 `/강퇴 [사용자명]` 명령어 사용

## 🔧 관리자 기능

관리자 계정(`앳새이하준`)으로 로그인시 추가 기능:
- 사용자 일시 정지 (5초, 10초, 20초, 1분)
- 사용자 강퇴
- 관리자 전용 메시지 표시

## 📱 반응형 지원

- 데스크톱: 최적화된 채팅 인터페이스
- 태블릿: 적응형 레이아웃
- 모바일: 터치 친화적 UI

## 🎨 디자인 특징

- 인스타그램 스타일 그라디언트
- 부드러운 애니메이션과 전환 효과
- 다크모드 자동 지원
- 접근성 고려 설계

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

Made for Seryun Middle School's students.
