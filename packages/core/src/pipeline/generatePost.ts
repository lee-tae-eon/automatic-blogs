import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";
import { TavilyService } from "../services/tavilyService";
import { DbService } from "../services/dbService";
import { analyzeTopicIntent } from "../util/autoInference";
import { KeywordScoutService } from "../services/KeywordScoutService";

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

  const safeReferenceRegex = /(\[(뉴스|출처|Reference)\s*\d*\]|\((출처|Source):.*?\))/gi;
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

  const refineSpacing = (text: string): string => {
    return text.split("\n").map(line => {
      if (line.trim().length === 0 || line.match(/^(\s*[-*>]|\s*\d+\.|\||#|\[)/)) return line;
      return line.replace(/(\.|!|\?)\s+(?=[가-힣a-zA-Z])/g, "$1\n\n");
    }).join("\n");
  };

  content = refineSpacing(content);
  content = content.replace(/\n\n/g, "\n\n\n"); 

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
            adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
          });
          // [v4.3] 너무 긴 주제는 API에서 에러가 나므로 앞의 2~3단어만 추출하여 분석
          const cleanTopic = task.topic.split("\n")[0].trim();
          const scoutKeyword = cleanTopic.split(" ").slice(0, 3).join(" "); 
          const volumeData = await scout.getMonthlySearchVolume(scoutKeyword);
          if (volumeData.related && volumeData.related.length > 0) {
            semanticKeywords = [...new Set([...semanticKeywords, ...volumeData.related.slice(0, 5)])];
          }
        } catch (e) { console.warn("⚠️ 키워드 분석 실패:", e); }
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

      // 캐시 확인
      const cachedPost = db.getCachedPost(task.topic, task.persona, task.tone);
      if (cachedPost) {
        onProgress?.("♻️ 기존 콘텐츠 재사용");
        return cachedPost;
      }

      // 2. 뉴스 데이터 확보
      let newsContext = "";
      onProgress?.("데이터 확보 중...");
      const cachedNews = db.getRecentNews(task.topic);

      if (cachedNews) {
        newsContext = cachedNews.content;
        inputParams.latestNews = `[기존 저장된 정보 활용]\n${cachedNews.content}`;
      } else {
        const cleanTopic = task.topic.split("\n")[0].trim();
        let searchQuery = `${cleanTopic} 2026년 최신 정보`;
        const tavily = new TavilyService();
        const searchResult = await tavily.searchLatestNews(searchQuery);
        newsContext = searchResult.context;
        inputParams.latestNews = newsContext || "최신 정보 없음";

        if (newsContext && newsContext.length > 50) {
          db.saveNews(task.topic, newsContext, searchResult.rawResults);
        }
      }

      onProgress?.("AI 포스팅 초안 생성 중...");
      const aiPost = await generatePostSingleCall(client, inputParams);

      // 출처 복구
      if ((!aiPost.references || aiPost.references.length === 0) && newsContext) {
        const recentNews = db.getRecentNews(task.topic);
        if (recentNews?.references?.length) {
          aiPost.references = recentNews.references.map(ref => ({
            name: ref.name.replace(/ [-|] /g, " (") + (ref.name.includes(" - ") || ref.name.includes(" | ") ? ")" : ""),
            url: ref.url
          })).slice(0, 3);
        }
      }

      const rawPublication: Publication = {
        ...aiPost,
        category: task.category,
        persona: task.persona,
        tone: task.tone,
        createdAt: new Date().toISOString(),
      };

      onProgress?.("🛡️ 안전 가이드라인 검수 중...");
      const sanitizedPublication = sanitizeContent(rawPublication, task.topic);

      // [v4.1] 출처(References)를 본문 하단에 클릭 가능한 링크 형식으로 추가
      if (sanitizedPublication.references && sanitizedPublication.references.length > 0) {
        const refSection = "\n\n## 참고 자료\n" + 
          sanitizedPublication.references.map(ref => `- [${ref.name}](${ref.url})`).join("\n");
        sanitizedPublication.content += refSection;
      }

      db.savePost(task.topic, task.persona, task.tone, sanitizedPublication);

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