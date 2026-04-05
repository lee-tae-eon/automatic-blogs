---
trigger: always_on
---

---

## trigger: always_on

# 🌍 Project Global Rules: Aiden (Blog Automation)

## 필수 참조

@include: ../../../../../.agents/rules/global.md

## 0. Hierarchy of Rules

1. 상위 프로젝트(`/Users/itaeeon/Desktop/Personal/.agents/rules/global.md`)의 원칙을 계승하며, 이 파일은 `automatic-blogs` 프로젝트 내부의 특수한 상황에 대해 우선권을 가집니다.
   Inherit principles from the parent project's global rules, while this file takes precedence for specific situations within the `automatic-blogs` project.

## 1. Core Tech Stack (Aiden Standard)

- **Monorepo Strategy**: `pnpm` workspace를 기반으로 패키지를 관리하며, 모든 공통 로직은 `packages/core`에 모듈화합니다. Manage packages based on `pnpm` workspace; modularize all common logic in `packages/core`.
- **Language**: TypeScript (Strict Mode). `any` 타입 사용은 금지됩니다. (No explicit 'any' allowed).
- **Core Engine**: Gemini 2.5 / 3 Flash. API 키 순환(Rotation) 전략을 준수합니다. (Strictly follow API key rotation strategy).
- **Automation**: Playwright. 네트워크 대기(NetworkIdle) 및 캡차 대응 로직을 표준화합니다. (Standardize network wait and captcha response logic).

## 2. Agent Interaction Pipeline (Workflow)

모든 기능 개발 및 포스트 생성은 아래의 **3단계 검증 프로세스**를 거쳐야 합니다:

1. **Echo (Strategist)**: 주제 선정 및 SEO 전략 수립. (Define Topic & SEO Strategy).
2. **Ryan (Constructor)**: 기능 구현 및 블로그 콘텐츠 생성. (Build Features & Content).
3. **Blog Inspector (Guardian)**: 품질 검수 및 시스템 정책 최종 승인. (Quality Audit & Final Approval).

## 3. Communication Style

- 모든 에이전트 간의 핸드오프(Handoff) 및 로그 기록은 반드시 **한국어 문장. English sentence.** 형식을 유지합니다.
- All handoffs and logs between agents must maintain the **Korean sentence. English sentence.** format.

## 4. Safety & Ethics

- 검색 플랫폼(네이버, 티스토리 등)의 서비스 이용 약관을 준수하며, 계정 보호를 위해 무리한 속도의 자동화를 금지합니다.
- Comply with search platform terms of service; prohibit excessive automation speeds to protect accounts.
