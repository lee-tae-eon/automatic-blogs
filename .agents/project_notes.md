# 📝 Project Notes - automatic-blogs (Aiden)

## 📅 Dev Logs (Reverse Chronological Order)

### 2026-04-14 | [Lead Constructor] | v11.4 Golden Keyword Scoring Engine
- Changes: Integrated `KeywordScoutService` with `TopicRecommendationService`. Now fetches real-time PC/Mobile search volume and blog post count for every curated topic. Added `goldenScore`, `searchVolume`, and `competitionIndex` fields.
- Result: PASSED. AI-recommended topics are automatically ranked by their inflow probability. UI displays 점수(Score) and 검색량(Volume) badges for data-driven topic selection.
- Next: Final system audit and roadmap for Phase 12 (Multi-platform & Scaling).

### 2026-04-13 | [Lead Constructor] | v11.3 TrendDiscovery Scroll Layout Fix
- **상세**: `TrendDiscovery` 컴포넌트에 `maxHeight: "550px"` 및 `flex: 1`을 적용하여 내부 스크롤 활성화.
- **결과**: 검색 결과가 많아져도 메인 페이지가 길어지지 않고 박스 내에서 스크롤 가능해짐 (UI 안정성 확보).
- **다음 단계**: v11.4 황금키워드 스코어링 엔진 설계.

### 2026-04-13 | [Lead Constructor] | v11.2 UI Consolidation & Layout Optimization
- **상세**: 레거시 `AutoPilotControl` 제거 및 `TrendDiscovery`를 최상단 헤더 아래로 배치. `ManualTaskInput`의 트렌드 상태를 `App.tsx`로 끌어올려 통합 관리.
- **결과**: 중복 기능 제거 및 1200px 전체 너비를 활용하는 시원한 레이아웃 완성. 데이터 흐름(트렌드 선택 -> 폼 입력) 자동화.

### 2026-04-12 | [Lead Constructor] | v11.1 Q&A Format Fix & Image Pipeline Refinement
- **상세**: 
  - Q&A 섹션에서 'A.' 직후 줄바꿈이 발생하는 버그 수정 (프롬프트 강화).
  - 차트 이미지(`chart_`) 텍스트 합성 제외 로직 추가 및 실사 이미지(Pexels) 강제 확보 프로세스 구현.
  - 네이버 전용 `[썸네일전용: ...]` 태그 도입으로 본문 노출 없이 대표 이미지로만 설정 가능하게 함.
- **결과**: 텍스트 합성은 보류 중이나, 향후 전용 캐리커처 사용을 위한 기반 구조 완성.

### 2026-04-11 | [Lead Constructor] | v11.0 AI Thumbnail Hook Generator (HOLD)
- **상세**: `sharp` 라이브러리를 활용하여 이미지 내 텍스트(제목, 카테고리) 합성 엔진 구현. AI가 20자 이내의 강렬한 후킹 문구(`thumbnailHook`) 생성 로직 추가.
- **결과**: 기술적 구현 완료되었으나, 사용자 전용 이미지(캐리커처) 도입 결정을 위해 현재 기능 보류(Reverted).

### 2026-04-07 | [Lead Constructor] | v10.12 UI Reset & Trend Recency Enhancement
- **상세**: 
  - 카테고리 변경 시 검색 입력창(`trendQuery`) 초기화 로직 추가.
  - Tavily 검색 시 `time_range: "day"` 옵션 강제 적용 및 `advanced` 검색 단계 상향.
- **결과**: 주가지수 등 실시간 데이터의 최신성 확보 (24시간 이내 데이터 보장).

### 2026-04-06 | [Candy/Blogger] | Project Structure Standardization
- **상세**: `TASKS.md` 및 `project_notes.md`를 `.agents/` 폴더로 이동하여 글로벌 표준 관리 체계 확립.
- **결과**: 타 프로젝트(`DayFlow` 등)와의 관리 일관성 확보.

### 2026-04-05 | [Lead Constructor] | v10.10 Persona Visual Strategy & Exclusive Sections
- **상세**: 페르소나별로 선호하는 차트 종류, 표 구성 및 특화 섹션(`Insight 2026`, `ROI-Simulator` 등)을 프롬프트에 동적 주입.
- **결과**: 페르소나의 전문성에 따른 포스팅 레이아웃 차별화 성공.

### 2026-04-05 | [Lead Constructor] | v10.9 Keyword Logic Refinement
- **상세**: 핫이슈 선택 시 키워드 자동 삽입을 제거하여 AI가 본문 문맥에 맞게 스스로 키워드를 산출하도록 변경.
- **결과**: 인위적인 키워드 반복 감소 및 자연스러운 SEO 최적화 유도.

### 2026-04-04 | [Lead Constructor] | v10.8 User Query Support & Model Retry Loop
- **상세**: 
  - 트렌드 검색 시 사용자 입력 검색어 지원.
  - 3개의 API 키와 5개의 모델(Gemini 3.1 Pro 등)을 순환 시도하는 15회 재시도 루프 구현.
- **결과**: 할당량 초과 시에도 작업 중단 없이 끝까지 토픽 수집 보장.

### 2026-04-04 | [Lead Constructor] | v10.6 Q&A Readability & List Termination Fix
- **상세**: 리스트 끝에 빈 리스트(`- `) 생성 방지 지침 및 Q&A 섹션에 `Q.`, `A.`, `<br>` 기호 사용 명문화.
- **결과**: 포스팅의 시각적 완성도 및 가독성 비약적 향상.

### 2026-04-02 | [Lead Constructor] | v10.3 Manual Layout Ratio Adjustment
- **상세**: `ManualTaskInput`의 트렌드 대 폼 비율을 1:1로 조정하여 가독성 개선.
- **결과**: 트렌드 검색 결과 확인이 훨씬 용이해짐.

### 2026-04-01 | [Lead Constructor] | v10.0~10.1 Dynamic Query & Finance Category Split
- **상세**: 
  - 고정 쿼리 대신 AI가 매번 동적으로 검색어를 생성하는 엔진 도입.
  - '금융/재테크/보험' 카테고리 독립 및 타 카테고리에서의 대출 키워드 필터링 강화.
- **결과**: 매일 중복되지 않는 신선한 소재 발굴 가능 및 블로그 저품질 방지.

### 2026-03-31 | [Lead Constructor] | v8.8 Premium Hero Image Strategy
- **상세**: 수동 이미지 지정 -> 안티그래비티 최신 이미지 -> Pexels 순의 3단계 이미지 확보 전략 수립.
- **결과**: 대표 이미지의 품질 및 자율성 확보.

### 2026-03-30 | [Lead Constructor] | v9.0 Domain-Persona Synchronization
- **상세**: 도메인(IT, 건강 등)에 따른 전용 페르소나 매칭 및 세부 작문 지침(TopicGuidance) 적용.
- **결과**: 분야별 전문 작가가 쓴 듯한 톤앤매너 구현.

---

## 🛠️ 주요 아키텍처 결정 (Architecture Decisions)
- **Monorepo Strategy**: 모든 비즈니스 로직은 `packages/core`에, UI는 `apps/desktop`에 분리하여 유지보수성 극대화.
- **State Lifting**: 트렌드와 입력 폼 간의 원활한 상호작용을 위해 최상위 `App.tsx`에서 주요 상태를 관리함.

## 🐛 트러블슈팅 (Troubleshooting)
- **Q&A Line Break Issue**: AI가 'A.' 뒤에 습관적으로 엔터를 쳐서 마크다운 형식이 깨지던 문제를 강력한 프롬프트 지침으로 해결.
- **Tavily Recency Issue**: 검색 시 `time_range` 옵션 누락으로 과거 정보가 섞이던 문제를 `day` 옵션 강제 적용으로 해결.
