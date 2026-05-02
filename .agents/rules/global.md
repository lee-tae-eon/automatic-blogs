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

**[MANDATORY] Next Task Designation**: 
작업 완료 시, 반드시 `TASKS.md`에 다음 수행할 작업을 구체적으로 명시하고 `NOW` 상태를 업데이트해야 합니다. (Upon task completion, you MUST specify the next task in `TASKS.md` and update `NOW` status).

**[CRITICAL] Preservation of Existing Logic (Surgical Update Principle)**:
앞으로의 모든 작업(신규 개발, 에러 수정 등)은 **기존에 안정적으로 작동하는 로직과 구조를 최대한 보존**하며 진행합니다. 파일을 통째로 새로 쓰는 방식(Full Rewrite)을 금지하며, 문제 지점만 정밀하게 수정하는 **'수술적 업데이트'**를 수행하세요. (Every task MUST preserve existing logic and perform only surgical updates).

## 3. Communication Style

- 모든 에이전트 간의 핸드오프(Handoff) 및 로그 기록은 반드시 **한국어 문장. English sentence.** 형식을 유지합니다.
- All handoffs and logs between agents must maintain the **Korean sentence. English sentence.** format.
- 사용자 요청이 **한글**이면 → 요청내용만 영문으로 번역해서 상단에 제공한다
- 사용자 요청이 **영문**이면 → 요청내용만 원어민 수준으로 refine해서 상단에 제공한다

## 5. Engineering Standards & Validation

- **[MANDATORY] Build & Test**: 모든 코드 수정 작업 후에는 반드시 `pnpm core:build` (또는 관련 패키지 빌드)를 실행하여 빌드 성공 여부를 확인해야 합니다.
- **[MANDATORY] Verification**: 빌드 성공 후에는 관련 테스트 스크립트나 앱 실행을 통해 변경 사항이 의도대로 동작하는지 최종 검증해야 합니다.
- **Surgical Updates**: 코드 변경 시 불필요한 리팩토링은 지양하며, 오직 요청된 기능 및 버그 수정에 집중합니다.
