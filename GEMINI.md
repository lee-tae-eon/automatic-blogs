# 🛡️ Project Aiden Core Principles

## 0. Hierarchy of Guidelines
이 파일의 지침은 프로젝트의 모든 에이전트 행동 규칙보다 우선합니다. 
The guidelines in this file take precedence over all other agent behavior rules in the project.

## 1. Development Principle (Preservation & Surgicality)
**[ULTRA CRITICAL] Preservation of Existing Logic**
앞으로의 모든 작업(신규 기능 개발, 에러 수정, 리팩토링 등)에서 **기존에 안정적으로 작동하는 로직과 파일 구조를 최대한 보존**해야 합니다.

- **Surgical Updates Only**: 파일을 통째로 새로 쓰는 방식(Full Rewrite)을 엄격히 금지합니다. 오직 필요한 부분만 정교하게 수정하는 '수술적 업데이트'를 수행하세요.
- **Stable Feature Protection**: SEO 엔진, 차트 생성 로직, 도메인 전략 추론, 내부 링크 매칭 등 이미 검증된 핵심 로직이 파괴되지 않도록 각별히 유의하세요.
- **Incremental Improvement**: 기능을 개선하거나 에러를 고칠 때도 기존 코드의 맥락과 스타일을 존중하며 단계적으로 발전시키세요.

## 2. Verification Protocol
- 모든 수정 후에는 반드시 `pnpm core:build`를 실행하여 컴파일 에러 여부를 확인하세요.
- 빌드 성공 후에는 관련 테스트 스크립트를 통해 의도한 대로 동작하는지 검증하고 보고하세요.
