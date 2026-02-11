# 🤖 Blog Automation System (Aiden)

본 프로젝트는 AI를 활용하여 콘텐츠 생성부터 다중 플랫폼(네이버, 티스토리 등) 자동 발행까지의 전 과정을 자동화하는 **엔터프라이즈급 블로그 자동화 솔루션**입니다.

This project is an **enterprise-grade blog automation solution** that automates the entire process from content generation using AI to automatic publication on multiple platforms (Naver, Tistory, etc.).

---

## 🌟 Key Features

### 1. 무적의 3대장 페르소나 (The Trio Personas)
단순한 텍스트 생성을 넘어, 목적에 특화된 3가지 핵심 페르소나를 제공합니다.
Beyond simple text generation, it provides three core personas specialized for different purposes.

*   📊 **분석가 (The Analyst)**: 수치와 팩트 중심의 전문 정보 전달 (표 활용, 3줄 요약 필수)
*   ✍️ **리뷰어 (The Reviewer)**: 내돈내산 컨셉의 친근한 경험 공유 (해요체, 생생한 묘사)
*   🎙️ **리포터 (The Reporter)**: 속도감 있는 뉴스 및 이슈 전달 (습니다/요 혼용, 타임라인 구조)

### 2. 오토파일럿 모드 (Autonomous Auto-Pilot)
주제 하나만 던지면 AI가 시장을 분석하고 최적의 전략으로 발행까지 완료합니다.
Just provide a topic, and the AI will analyze the market and complete everything up to publication with an optimal strategy.

*   **Topic Expander**: 상위 주제를 바탕으로 황금 키워드 발굴
*   **Keyword Scout**: 네이버 검색광고 API 연동 실시간 경쟁률 분석
*   **Strategy Engine**: 경쟁사 구조 분석 및 차별화 전략 수립

### 3. 고퀄리티 가독성 최적화 (Premium Readability)
*   **마이크로 브리딩 (Micro-Breathing)**: 모바일 환경을 고려하여 쉼표(,) 뒤 자동 줄바꿈 및 문장 길이 조절.
*   **시각적 강조**: 핵심 단어 자동 **굵게(Bold)** 처리 및 리스트/표 시각화.
*   **클린 HTML**: 네이버 에디터 호환성을 극대화한 CSS-Free 순수 HTML 생성.

### 4. 지능형 인프라 (Smart Infrastructure)
*   **Key Rotation**: 3개의 Gemini API 키를 자동으로 순환하며 할당량 문제 해결.
*   **Hybrid Storage**: SQLite를 기본으로 하되, 환경에 따라 JSON Fallback 자동 전환.
*   **Anti-Bot**: Playwright 기반의 자연스러운 사용자 동작 모방.

---

## 🛠 Tech Stack

*   **Language**: TypeScript (Strict Mode)
*   **Backend**: Node.js, `@blog-automation/core` (Monorepo)
*   **GUI**: Electron, React, Vite, Sass
*   **AI**: Google Gemini (Pro/Flash), Tavily (Search)
*   **Automation**: Playwright (Browser Control)
*   **Database**: SQLite (better-sqlite3), JSON

---

## 🚀 Getting Started

### 1. 환경 설정 (Setup)
`.env` 파일을 루트 디렉토리에 생성하고 아래 정보를 입력합니다.
Create a `.env` file in the root directory and enter the following information.

```env
VITE_GEMINI_API_KEY=your_primary_key
VITE_GEMINI_API_SUB_KEY=your_secondary_key
VITE_GEMINI_API_THIRD_KEY=your_third_key

VITE_NAVER_SEARCH_API_CLIENT=...
VITE_NAVER_SEARCH_API_KEY=...
VITE_TAVILY_API_KEY=...
```

### 2. 의존성 설치 및 빌드 (Install & Build)
```bash
pnpm install
pnpm --filter @blog-automation/core build
```

### 3. 실행 (Run)
*   **Desktop App**: `pnpm --filter @blog-automation/desktop dev`
*   **CLI Test**: `npx ts-node apps/cli/src/manualTest.ts`

---

## 📂 Project Structure

```text
├── apps/
│   ├── desktop/          # Electron GUI Application
│   └── cli/              # Command Line Interface tools
├── packages/
│   └── core/             # Core Logic (AI, Pipeline, Publisher)
│       ├── src/ai/       # Gemini/GPT Client
│       ├── src/pipeline/ # Content Generation Workflows
│       ├── src/publisher/# Naver/Tistory Automators
│       └── src/persona/  # Persona & Tone Configs
└── data/                 # Database & Cache files
```

---

## 📜 Development Guidelines

*   **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:` 등의 태그를 사용하여 커밋 메시지를 작성합니다.
*   **Config First**: 모든 프롬프트와 메트릭은 하드코딩하지 않고 `packages/core/src/persona/` 설정 파일을 따릅니다.
*   **Safety**: AI 정체성(자기소개) 언급 및 단어 쪼개짐은 엄격히 금지됩니다.

---
_Last Updated: 2026-02-11_