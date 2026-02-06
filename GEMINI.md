# 🤖 Blog Automation System: Agent Context

이 파일은 시스템의 핵심 철학과 아키텍처를 정의합니다. 에이전트는 모든 코드 수정 및 기능 구현 시 이 문서를 최우선 지침으로 삼습니다.
This file defines the core philosophy and architecture of the system. The agent uses this document as the primary guide for all code modifications and feature implementations.

## 1. 프로젝트 개요 (Project Overview)

- **목적**: AI 기반 콘텐츠 생성부터 다중 플랫폼(네이버, 티스토리 등) 자동 발행까지의 전 과정을 자동화하는 통합 시스템.
- **구조**: `pnpm` workspaces 기반의 모노레포(Monorepo).
- **기술 스택**: Node.js, TypeScript, Playwright, Electron, React, Vite.

## 2. 시스템 아키텍처 (System Architecture)

### 📦 Packages & Apps

- **`@blog-automation/core`**: 비즈니스 로직의 심장부.
  - `ai/`: Gemini, OpenAI(GPT) 연동 및 프롬프트 엔지니어링.
  - `publisher/`: 플랫폼별 자동 발행 로직 (현재 `naverPub` 활성화).
  - `services/`: Tavily(검색), Pexels/Unsplash(이미지), Excel 처리 등 외부 서비스.
  - `pipeline/`: 콘텐츠 생성부터 발행까지의 워크플로우 관리.
- **`apps/desktop`**: Electron 기반 GUI 애플리케이션 (React + Vite).
- **`apps/cli`**: 명령줄 인터페이스 도구.

## 3. 핵심 기술 원칙 (Core Technical Principles)

- **안정성 (Stability)**: 네이버의 안티봇 메커니즘을 회피하기 위해 Playwright의 `launchPersistentContext`를 활용하며, 자연스러운 사용자 동작(Typing, Delay)을 모방합니다.
- **모듈화 (Modularity)**: Clean Architecture를 준수하며, 각 기능은 인터페이스 기반으로 설계되어 교체가 용이해야 합니다.
- **AI 전략 (AI Strategy)**: 다중 AI 모델(Gemini, GPT)을 지원하며, `persona` 설정을 통해 톤앤매너를 관리합니다.

## 4. 코딩 컨벤션 (Coding Convention)

- **언어**: TypeScript (Strict Mode 필수).
- **비동기 처리**: `async/await`를 기본으로 하며, 복잡한 체이닝보다는 명확한 가독성을 지향합니다.
- **에러 핸들링**: `try-catch`와 함께 도메인 특화 커스텀 에러 클래스를 활용합니다.
- **주석**: 복잡한 로직에는 JSDoc을 작성하되, 코드 자체가 설명이 되도록 명확한 네이밍을 사용합니다.

## 5. 개발 가이드라인 (Development Guidelines)

- **의존성**: 패키지 버전 변경은 신중해야 하며, 반드시 `pnpm` 명령어를 사용합니다.
- **테스트**: 새로운 기능 추가 시 `apps/cli` 또는 전용 테스트 스크립트를 통해 로직을 검증합니다.
- **데이터 보존**: `.auth/` 디렉토리에 저장되는 세션 정보가 유실되지 않도록 주의합니다.
- **Git 제어**: 사용자가 명시적으로 요청하지 않는 한 에이전트는 커밋, 푸시 등 Git 작업을 수행하거나 제안하지 않습니다. (Git control: The agent will not perform or suggest Git operations like commit/push unless explicitly requested by the user.)

## 6. 답변의 정의

-- **한/영**: 한글 답변 한문장 + 영어 답변 한문장을 기본으로 합니다.

---

_이 컨텍스트는 지속적으로 업데이트되며, 에이전트는 항상 최신 상태를 유지해야 합니다._
_This context is continuously updated, and the agent must always stay up to date._
