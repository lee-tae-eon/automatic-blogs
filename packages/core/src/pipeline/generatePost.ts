import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";
import { TavilyService } from "../services/tavilyService";
import { PexelsService } from "../services/pexelImageService";
import { NaverSearchService } from "../services/naverSearchService";
import { DbService } from "../services/dbService";
import { analyzeTopicIntent } from "../util/autoInference";
import { KeywordScoutService } from "../services/KeywordScoutService";
import { ChartService } from "../services/chartService";
import path from "path";
import fs from "fs";

/**
 * 🛡️ [Safety] 콘텐츠 안전 검수 및 강제 수정 함수 (Sanitizer)
 */
function sanitizeContent(publication: Publication, topic: string): Publication {
  const sensitiveRegex = /자살|살인|범죄|성폭력|마약|학대|극단적|충격/i;
  const isSensitive = sensitiveRegex.test(topic);

  let { title, content } = publication;
  let isModified = false;

  if (/자살/g.test(title) || /극단적 선택/g.test(title)) {
    console.warn("🛡️ [Safety] 제목의 금지어를 순화합니다.");
    title = title
      .replace(/자살/g, "사망")
      .replace(/극단적 선택/g, "비극적 사건")
      .replace(/충격/g, "속보");
    isModified = true;
  }

  const safeReferenceRegex =
    /(\[(뉴스|출처|Reference)\s*\d*\]|\((출처|Source):.*?\))/gi;
  if (safeReferenceRegex.test(content)) {
    console.log("🧹 [Sanitizer] 본문 내 뉴스 참조 마커 정밀 제거");
    content = content.replace(safeReferenceRegex, "");
    isModified = true;
  }

  if (/자살/g.test(content)) {
    console.warn("🛡️ [Safety] 본문의 금지어를 순화합니다.");
    content = content.replace(/자살/g, "사망");
    isModified = true;
  }

  const oldContent = content;

  // [v4.8] 강조(Bold) 내부에 불필요하게 포함된 따옴표 제거 (**'텍스트'** -> **텍스트**)
  content = content
    .replace(/\*\*['"](.*?)['"]\*\*/g, "**$1**")
    .replace(/<strong>['"](.*?)['"]<\/strong>/g, "<strong>$1</strong>");

  const refineSpacing = (text: string): string => {
    return text
      .split("\n")
      .map((line) => {
        // 리스트, 표, 헤딩 등은 건드리지 않음
        if (
          line.trim().length === 0 ||
          line.match(/^(\s*[-*>]|\s*\d+\.|\||#|\[)/)
        )
          return line;

        // [v4.4] AI가 의도한 단일 줄바꿈(쉼표 뒤 등)은 보존하고,
        // 문장이 완전히 끝나는 지점(. ! ?) 뒤에 공백이 있을 때만 문단 나눔 수행
        return line.replace(/(\.|!|\?)\s+(?=[가-힣a-zA-Z])/g, "$1\n\n");
      })
      .join("\n");
  };

  content = refineSpacing(content);
  // 연속된 엔터 3개 이상만 정리 (AI의 의도적 엔터 2개는 보존)
  content = content.replace(/\n{4,}/g, "\n\n\n");

  if (content !== oldContent) {
    console.log("📱 [Mobile] 문단 간격을 넓혀 가독성을 최적화했습니다.");
    isModified = true;
  }

  const safetyFooter = `
<br/>
<hr/>
<p style="text-align: center; color: #666; font-size: 0.9em; line-height: 1.6;">
<strong>※ 우울감 등 말하기 어려운 고민이 있거나 주변에 이런 어려움을 겪는 가족·지인이 있을 경우<br/>
자살예방 상담전화 ☎109에서 24시간 전문가의 상담을 받을 수 있습니다.</strong>
</p>
`;

  if (isSensitive && !content.includes("109")) {
    content += safetyFooter;
    isModified = true;
  }

  return { ...publication, title, content };
}

export async function generatePost({
  client,
  task,
  projectRoot,
  onProgress,
}: GeneratePostInput): Promise<Publication> {
  const MAX_RETRIES = 1;
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(`AI 콘텐츠 생성 시작 (${attempt}/${MAX_RETRIES})`);

      // 1. 세만틱 키워드 보강 (v3.29 전역 적용)
      let semanticKeywords = task.keywords || [];
      if (semanticKeywords.length < 3) {
        onProgress?.("🔍 연관 키워드 분석 중...");
        try {
          const scout = new KeywordScoutService({
            searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
            searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
            adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
            adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
            adCustomerId:
              process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
          });
          // [v4.3] 너무 긴 주제는 API에서 에러가 나므로 앞의 2~3단어만 추출하여 분석
          const cleanTopic = task.topic.split("\n")[0].trim();
          const scoutKeyword = cleanTopic.split(" ").slice(0, 3).join(" ");
          const volumeData = await scout.getMonthlySearchVolume(scoutKeyword);
          if (volumeData.related && volumeData.related.length > 0) {
            semanticKeywords = [
              ...new Set([
                ...semanticKeywords,
                ...volumeData.related.slice(0, 5),
              ]),
            ];
          }
        } catch (e) {
          console.warn("⚠️ 키워드 분석 실패:", e);
        }
      }

      const inputParams: BlogPostInput = {
        topic: task.topic,
        persona: task.persona,
        category: task.category,
        tone: task.tone,
        keywords: semanticKeywords,
        mode: task.mode || "manual",
        strategy: task.strategy,
      };

      const dbPath = projectRoot || process.cwd();
      const db = new DbService(dbPath);

      // ✅ [v5.2] 내부 링크(Internal Linking) 추천 데이터 확보
      // 현재 분석된 세만틱 키워드를 기반으로 과거 포스팅 조회
      const internalLinks = db.getRelatedPosts(semanticKeywords, 5); // ✅ [v5.3] SEO: 내부 링크 최대 5개로 확장
      if (internalLinks && internalLinks.length > 0) {
        inputParams.internalLinkSuggestions = internalLinks;
        console.log(
          `🔗 [InternalLink] ${internalLinks.length}개의 연관 포스팅을 발견했습니다.`,
        );
      }

      // 캐시 확인
      const cachedPost = db.getCachedPost(task.topic, task.persona, task.tone);
      if (cachedPost) {
        onProgress?.("♻️ 기존 콘텐츠 재사용");
        return cachedPost;
      }

      // 2. 데이터 확보 (Tavily + Naver)
      let newsContext = "";
      onProgress?.("실시간 전문 데이터 확보 중...");
      const cachedNews = db.getRecentNews(task.topic);

      if (cachedNews) {
        newsContext = cachedNews.content;
        inputParams.latestNews = `[기존 저장된 정보 활용]\n${cachedNews.content}`;
      } else {
        const cleanTopic = task.topic.split("\n")[0].trim();
        const tavily = new TavilyService();
        const naverSearch = new NaverSearchService({
          clientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
          clientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
        });

        // 두 API 병렬 호출 (속도 최적화)
        const [tavilyResult, naverResult] = await Promise.all([
          tavily.searchLatestNews(cleanTopic),
          naverSearch.searchBlog(cleanTopic, 3),
        ]);

        // 데이터 통합
        newsContext = `
# [웹 검색 및 분석 데이터 (Tavily)]
${tavilyResult.context}

# [네이버 블로그 실시간 동향 (Naver)]
${naverResult}
        `.trim();

        inputParams.latestNews = newsContext || "최신 정보 없음";

        if (newsContext && newsContext.length > 100) {
          // 참고자료는 Tavily의 원문 위주로 저장 (네이버는 요약만 활용)
          db.saveNews(task.topic, newsContext, tavilyResult.rawResults);
        }
      }

      onProgress?.("AI 포스팅 초안 생성 중...");
      const aiPost = await generatePostSingleCall(client, inputParams);

      // [v5.0] NotebookLM 기반 자가 검증(Self-Critic) 로직
      // NotebookLM 사용을 선택했고, 모드가 '자동(auto)'일 경우에만 수행
      let finalAiPost = aiPost;
      if (task.useNotebookLM && task.notebookMode === "auto") {
        onProgress?.("🧠 NotebookLM 전략 기반 품질 고도화 중...");
        const criticPrompt = `
          당신은 NotebookLM의 분석 기법을 완벽히 마스터한 콘텐츠 교정 전문가입니다.
          아래 작성된 블로그 초안을 **'편집 신뢰(Editorial Trust)'**와 **'인과관계의 끈(Golden Thread)'** 원칙에 따라 대폭 개선하세요.

          [초안 본문]:
          ${aiPost.content}

          [교정 지침]:
          1. **편집 신뢰(Editorial Trust)**: 인용된 정보의 출처가 왜 신뢰할 수 있는지 맥락을 보강하고, 단순히 사실을 나열하는 것이 아니라 비판적으로 검증된 느낌을 주도록 다듬으세요.
          2. **인과관계의 끈(Golden Thread)**: 상위 주제와 하위 실행 과제 간의 논리적 연결 고리를 강화하여 독자가 글의 흐름을 명확히 추적할 수 있게 하세요.
          3. **인간미 넘치는 문장 (Anti-AI & Humanizer)**: 기계적인 문투(일정한 길이, 로봇 같은 어조)를 완전히 제거하고, 아주 짧은 문장과 긴 문장을 섞어 리듬감을 주며 "솔직히 말씀드리면", "이게 왜 중요하냐면" 같은 사람 냄새 나는 표현을 글 중간에 자연스럽게 1~2회 섞으세요.
          4. **구조 최적화**: 모바일 가독성을 유지하면서도 논리적 구조가 돋보이도록 문단을 재배치하세요.
          5. **[매우 중요] 뻔한 맺음말 절.대. 금지**: "결론적으로", "요약하자면", "이상으로 ~에 대해 알아보았습니다", "~하는 데 도움이 되길 바랍니다" 같은 판에 박힌 AI식 맺음말을 **절대 사용하지 마세요.**
          6. **[매우 중요] 絶対 금지 사항**: 
             - "다음은 ~개선된 블로그 초안입니다", "수정했습니다" 등 어떠한 인사말, 서론, 결론, 부가 설명도 **절대 금지**합니다.
             - **마크다운 문법 보존**: 리스트(\`- \`, \`1. \`) 기호와 강조(\`**\`) 기호 사이에 절대 줄바꿈(\n)이나 빈 줄을 넣지 마세요. (예: \`- **1.\n\n태국**\` -> 절대 금지, \`- **1. 태국**\`으로 유지)
          7. **[출력 규칙]**: 반드시 최종 완성된 마크다운 본문 전체를 \`<content>\` 와 \`</content>\` 태그로 감싸서 출력하세요.
          
          출력 형식 예시:
          <content>
          여기에 최종 마크다운 본문 작성
          </content>
        `;

        try {
          let refinedContent = await client.generateText(criticPrompt);
          
          // AI가 지시를 무시하고 덧붙이는 텍스트를 방지하기 위해 <content> 태그 내부만 추출
          const contentMatch = refinedContent.match(/<content>([\s\S]*?)<\/content>/i);
          if (contentMatch) {
            refinedContent = contentMatch[1].trim();
          } else {
            // Fallback: 태그를 안썼을 경우 강력한 정규식으로 앞부분 찌꺼기 제거
            refinedContent = refinedContent
              .replace(/^[\s\S]*?(?:다음은|수정된|교정된|수정본|개선된|Here is|NotebookLM|Notebook LM|신뢰성|논리적).*?(?:\n\n|\n)/i, "")
              .trim();
          }

          if (refinedContent && refinedContent.length > 100) {
            finalAiPost = { ...aiPost, content: refinedContent };
            onProgress?.(
              "✨ NotebookLM 자동 검증 완료: 품질이 대폭 개선되었습니다.",
            );
          }
        } catch (e) {
          console.warn("⚠️ NotebookLM 자가 검증 실패 (원본 유지):", e);
        }
      }

      // 출처 복구
      if (
        (!finalAiPost.references || finalAiPost.references.length === 0) &&
        newsContext
      ) {
        const recentNews = db.getRecentNews(task.topic);
        if (recentNews?.references?.length) {
          finalAiPost.references = recentNews.references
            .map((ref) => ({
              name:
                ref.name.replace(/ [-|] /g, " (") +
                (ref.name.includes(" - ") || ref.name.includes(" | ")
                  ? ")"
                  : ""),
              url: ref.url,
            }))
            .slice(0, 3);
        }
      }

      const rawPublication: Publication = {
        ...finalAiPost,
        category: task.category,
        persona: task.persona,
        tone: task.tone,
        createdAt: new Date().toISOString(),
      };

      onProgress?.("🛡️ 안전 가이드라인 검수 중...");
      const sanitizedPublication = sanitizeContent(rawPublication, task.topic);

      // ✅ [v5.2.1] 출처(References) 정밀 필터링 및 본문 추가
      // 블로그, 카페, 커뮤니티 성격의 링크는 여기서 원천 차단합니다.
      if (
        sanitizedPublication.references &&
        sanitizedPublication.references.length > 0
      ) {
        const blockedPatterns = [
          /blog/i,
          /cafe/i,
          /tistory/i,
          /brunch/i,
          /egloos/i,
          /post\.naver/i,
          /naver\.me/i,
          /daum\.net\/blog/i,
          /velog/i,
          /medium/i,
          /kakao/i,
          /dcinside/i,
          /ruliweb/i,
          /theqoo/i,
          /instiz/i,
          /fmkorea/i,
          /clien/i,
          /youtube/i,
          /youtu\.be/i,
          /facebook/i,
          /instagram/i,
          /twitter/i,
          /x\.com/i,
          /pstatic/i,
          /kakaocdn/i,
        ];

        const filteredRefs = sanitizedPublication.references.filter((ref) => {
          const name = ref.name.toLowerCase();
          const url = ref.url.toLowerCase();

          // 1. URL 패턴 체크
          const isBlockedUrl =
            blockedPatterns.some((p) => p.test(url)) ||
            url.includes("/blog/") ||
            url.includes(".blog.");
          // 2. 이름 체크 (블로그, 카페 등의 단어가 들어간 매체 제외)
          const isBlockedName = /블로그|카페|brunch|티스토리|개인|포스트/i.test(
            name,
          );

          return !isBlockedUrl && !isBlockedName;
        });

        const hasRefSection = /참고\s*(자료|문헌|사이트)|References|출처/i.test(
          sanitizedPublication.content,
        );
        if (!hasRefSection && filteredRefs.length > 0) {
          const refSection =
            "\n\n## 참고 자료\n" +
            filteredRefs.map((ref) => `- [${ref.name}](${ref.url})`).join("\n");
          sanitizedPublication.content += refSection;
        }
        // 원본 reference 배열도 필터링된 버전으로 교체
        sanitizedPublication.references = filteredRefs;
      }

      // ✅ [v5.3] 매뉴얼 모드(Manual) 전용: 차트 태그 파싱 및 실제 이미지 생성
      if (
        (task.mode === "manual" || !task.mode) &&
        sanitizedPublication.content.includes("[차트:")
      ) {
        onProgress?.("📊 매뉴얼 모드 - 차트 이미지 생성 중...");
        const chartService = new ChartService();
        const content = sanitizedPublication.content;

        // 정규식을 통해 [차트: {...}] 형식 추출 (줄바꿈 포함 가능)
        const chartRegex = /\[\s*차트\s*:\s*(\{[\s\S]*?\})\s*\]/g;
        let match;
        const extractMatches = [];

        while ((match = chartRegex.exec(content)) !== null) {
          extractMatches.push({ full: match[0], jsonStr: match[1] });
        }

        for (const m of extractMatches) {
          try {
            const chartData = JSON.parse(m.jsonStr);
            const chartUrl = await chartService.generateChartUrl(chartData);

            if (chartUrl) {
              sanitizedPublication.content =
                sanitizedPublication.content.replace(
                  m.full,
                  `\n\n![차트 이미지](${chartUrl})\n\n`,
                );
            } else {
              // fallback if URL generation fails
              sanitizedPublication.content =
                sanitizedPublication.content.replace(
                  m.full,
                  `\n\n> 📊 **[차트 생성 오류]** 차트 URL을 생성하지 못했습니다.\n\n`,
                );
            }
          } catch (e) {
            console.error("❌ 매뉴얼 모드 차트 생성 에러:", e);
          }
        }
      }

      db.savePost(task.topic, task.persona, task.tone, sanitizedPublication);

      // ✅ [v5.4] 메모리 누수 방지: 30일 경과된 이미지 캐시 백그라운드 정리
      try {
        if (task.useImage !== false) {
          const pexels = new PexelsService();
          const deleted = pexels.cleanOldCache(
            path.join(projectRoot || process.cwd(), "temp_images"),
            30,
          );
          if (deleted > 0) {
            onProgress?.(
              `🧹 [캐시 정리] 30일 경과 이미지 ${deleted}장 삭제 완료`,
            );
          }
        }
      } catch (e) {
        console.warn("⚠️ 자동 캐시 정리 실패:", e);
      }

      onProgress?.("포스팅 생성 완료");
      return sanitizedPublication;
    } catch (error: any) {
      console.error(`[GeneratePost] Error:`, error);
      lastError = error;
      const dbPath = projectRoot || process.cwd();
      const db = new DbService(dbPath);
      db.deleteNews(task.topic);

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("429")) throw error;
      if (attempt < MAX_RETRIES) await delay(attempt * 2000);
    }
  }
  throw lastError;
}
