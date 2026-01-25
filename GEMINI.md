# 프로젝트 정보

- 프로젝트명: 블로그 자동화 시스템
- 기술 스택: Node.js, TypeScript, Electron, React, Vite
- 목적: 네이버 블로그, 티스토리 자동 포스팅
- 핵심 기능: AI 콘텐츠 생성, SEO 최적화, 자동 발행, 스케줄링

# 코딩 컨벤션

- 언어: TypeScript (strict mode)
- 스타일: ESLint + Prettier
- 네이밍: camelCase (변수/함수), PascalCase (클래스/인터페이스)
- 주석: JSDoc 형식
- 에러 핸들링: try-catch + 커스텀 에러 클래스
- 비동기: async/await (Promise 체이닝 지양)

# 아키텍처 원칙

- Clean Architecture (계층 분리)
- DI(Dependency Injection) 활용
- 단일 책임 원칙
- 인터페이스 기반 설계
- 가독성을 중요시한 설계

# 패키지 관리

- 패키지는 무조건 개발자의 관리 포인트 (절대 패키지 버전에 대해서는 함구)
