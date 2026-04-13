# MyTonation - Professional Streamer Alert System

**MyTonation**은 인터넷 방송인(스트리머)을 위한 고성능, 저지연 후원 알림 솔루션입니다. 투네이션(Toonation)의 핵심 기능을 벤치마킹하여, OBS 브라우저 소스 연동에 최적화된 아키텍처로 설계되었습니다.

## 🚀 Key Features

- **Real-time Alerting:** `Socket.io`를 활용한 이벤트 기반 실시간 데이터 전송.
- **Advanced TTS System:** 
  - **Server-side Rendering:** 외부 TTS API를 호출하여 서버에서 MP3 파일을 생성 및 캐싱. 
  - **Seamless Integration:** 후원 템플릿과 사용자 메시지를 하나의 음성 파일로 합성하여 자연스러운 알림 제공.
- **Dynamic UI/UX:**
  - **익명성 보장:** 프로필 이미지를 세련된 "익명" 텍스트 아이콘으로 대체하여 프라이버시 보호 및 깔끔한 디자인 구현.
  - **Customizable Styles:** 관리자 패널을 통해 닉네임, 금액, 메시지의 크기 및 애니메이션 스케일 실시간 조정.
- **Robust Architecture:** 포트 충돌 방지 및 동적 서버 주소 바인딩을 통해 다양한 배포 환경(Local, Cloud 등)에서 즉시 구동 가능.

## 🏗 System Architecture

본 프로젝트는 확장성과 유지보수성을 고려하여 **관심사 분리(Separation of Concerns)** 원칙에 따라 설계되었습니다.

### Backend (Node.js & Express)
- **Modular Routing:** API 엔드포인트를 기능별로 분리하여 관리.
- **Service Layer Pattern:** TTS 생성 로직 등을 별도의 서비스 레이어로 캡슐화하여 비즈니스 로직의 재사용성 확보.
- **Storage Management:** `Multer`를 통한 미디어 자산 관리 및 정적 파일 서빙.

### Frontend (React 19 & Vite)
- **Component-Based UI:** 관리자 패널(Admin)과 오버레이(Overlay)를 독립적인 컴포넌트로 구성.
- **Dynamic Resource Loading:** 서버 주소를 런타임에 감지하여 API 및 소켓 연결을 자동으로 설정.
- **CSS3 High-performance Animations:** GPU 가속을 활용한 부드러운 알림 효과 구현.

## 🛠 Tech Stack

- **Core:** Node.js, Express, React 19, Vite
- **Communication:** Socket.io (Websocket)
- **Styling:** Vanilla CSS (Custom Variables)
- **API:** Axios, Native Fetch API

## 📂 Project Structure

```text
tonation/
├── client/           # React Frontend (Vite)
│   ├── src/          # Components (Admin, Overlay, Styles)
│   └── public/       # Static Assets
├── server/           # Express Backend
│   ├── src/          
│   │   ├── routes/   # API 라우팅 레이어
│   │   └── services/ # 비즈니스 로직 레이어 (TTS Service 등)
│   ├── uploads/      # 동적 생성 미디어 (MP3, Images)
│   └── index.js      # 서버 진입점 및 환경 설정
└── README.md
```

## ⚙️ Quick Start

### 1. Installation
```bash
# 서버 의존성 설치
cd server && npm install

# 클라이언트 의존성 설치
cd ../client && npm install
```

### 2. Execution
두 개의 터미널에서 각각 실행합니다.
- **Server:** `cd server && npm start` (Port: 4000)
- **Client:** `cd client && npm run dev` (Port: 5173)

### 3. OBS Integration
1. `http://localhost:5173/admin`에서 알림 프리셋 설정.
2. `http://localhost:5173/overlay` 주소를 OBS 브라우저 소스에 추가.

## 📄 License
이 프로젝트는 ISC 라이선스를 따릅니다.
