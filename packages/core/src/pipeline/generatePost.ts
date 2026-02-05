import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";
import { TavilyService } from "../services/tavilyService";
import { DbService } from "../services/dbService";
import { analyzeTopicIntent } from "../util/autoInference";

/**
 * 🛡️ [Safety] 콘텐츠 안전 검수 및 강제 수정 함수 (Sanitizer)
 * - 보도준칙 4.0 및 플랫폼 정책 위반 소지가 있는 단어를 순화하고,
 * - 필수 상담 정보가 누락되었을 경우 강제로 삽입합니다.
 */
function sanitizeContent(publication: Publication, topic: string): Publication {
  // 1. 민감 주제 감지 (정규식)
  const sensitiveRegex = /자살|살인|범죄|성폭력|마약|학대|극단적|충격/i;
  const isSensitive = sensitiveRegex.test(topic);

  let { title, content } = publication;
  let isModified = false;

  // 2. 제목 강제 순화 (AI가 프롬프트를 무시했을 경우 대비)
  if (/자살/g.test(title) || /극단적 선택/g.test(title)) {
    console.warn("🛡️ [Safety] 제목의 금지어를 순화합니다.");
    title = title
      .replace(/자살/g, "사망")
      .replace(/극단적 선택/g, "비극적 사건")
      .replace(/충격/g, "속보"); // 자극적 단어 제외
    isModified = true;
  }

  // 3. 본문 강제 순화
  if (/자살/g.test(content)) {
    console.warn("🛡️ [Safety] 본문의 금지어를 순화합니다.");
    content = content.replace(/자살/g, "사망");
    isModified = true;
  }

  // 4. 상담 전화번호 강제 주입 (민감 주제인데 109 번호가 없을 경우)
  const safetyFooter = `
<br/>
<hr/>
<p style="text-align: center; color: #666; font-size: 0.9em; line-height: 1.6;">
<strong>※ 우울감 등 말하기 어려운 고민이 있거나 주변에 이런 어려움을 겪는 가족·지인이 있을 경우<br/>
자살예방 상담전화 ☎109에서 24시간 전문가의 상담을 받을 수 있습니다.</strong>
</p>
`;

  if (isSensitive && !content.includes("109")) {
    console.log("🛡️ [Safety] 상담 전화번호 푸터 강제 삽입");
    content += safetyFooter;
    isModified = true;
  }

  if (isModified) {
    console.log("✅ [Safety] 콘텐츠가 안전 가이드라인에 맞춰 수정되었습니다.");
  }

  return {
    ...publication,
    title,
    content,
  };
}

/**
 * @description ai client 로 부터 post 를 반환하는 함수
 * @param param0
 * @returns
 */
export async function generatePost({
  client,
  task,
  projectRoot,
  onProgress,
}: GeneratePostInput): Promise<Publication> {
  const MAX_RETRIES = 1; // 최대 1번 재시도 (API 비용 절약)
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(`AI 콘텐츠 생성 시작 (${attempt}/${MAX_RETRIES})`);

      const inputParams: BlogPostInput = {
        topic: task.topic,
        persona: task.persona,
        category: task.category,
        tone: task.tone,
        ...(task.keywords && { keywords: task.keywords }),
      };

      // 1. DB 서비스 초기화
      const dbPath = projectRoot || process.cwd();
      const db = new DbService(dbPath);

      // 2. 뉴스 데이터 확보 (Cache-First 전략)
      let newsContext = "";
      onProgress?.("데이터 확보 중...");
      const cachedNews = db.getRecentNews(task.topic);

      if (cachedNews) {
        onProgress?.("기존 저장된 데이터 활용");
        newsContext = cachedNews.content;
        inputParams.latestNews = `[기존 저장된 정보 활용]\n${cachedNews.content}`;
      } else {
        const topicIntent = analyzeTopicIntent(task.topic);
        let searchQuery = task.topic;
        
        // 장소 관련 주제인 경우 검색어 보강 (환각 방지)
        if (topicIntent.isPlace) {
          searchQuery = `${task.topic} 정확한 위치 상호명 메뉴 가격 정보`;
          onProgress?.(`장소 데이터 정밀 검색 중: ${task.topic}`);
        } else {
          onProgress?.(`실시간 정보 검색 중: ${task.topic}`);
        }

        const tavily = new TavilyService();
        newsContext = await tavily.searchLatestNews(searchQuery);

        inputParams.latestNews =
          newsContext ||
          "최신 정보를 가져오지 못했습니다. 만약 고유 명사(가게 이름 등)가 불확실하다면 임의로 지어내지 마세요.";

        if (newsContext && newsContext.length > 50) {
          onProgress?.("검색 결과 캐시 저장 중...");
          db.saveNews(task.topic, newsContext, []);
        }
      }

      onProgress?.("AI 포스팅 초안 생성 중...");
      const aiPost = await generatePostSingleCall(client, inputParams);
      console.log(`DEBUG [generatePost]: AI 응답 출처 개수: ${aiPost.references?.length || 0}`);

      // ✅ [Fallback] 주제 성격 분석 후, 진짜 뉴스가 필요한 경우에만 출처 강제 추출
      const topicIntent = analyzeTopicIntent(task.topic);
      if (
        topicIntent.needsCurrentInfo &&
        (!aiPost.references || aiPost.references.length === 0) &&
        newsContext
      ) {
        console.warn("⚠️ 뉴스 기반 주제임에도 출처가 누락되어 강제 추출을 시도합니다.");
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = newsContext.match(urlRegex);
        if (urls) {
          aiPost.references = [...new Set(urls)].map((url) => ({
            name: "관련 뉴스 (자동 추출)",
            url: url.replace(/[)\]]$/, ""),
          })).slice(0, 3);
          console.log(`DEBUG [generatePost]: 강제 추출된 출처 개수: ${aiPost.references.length}`);
        }
      } else if (!topicIntent.needsCurrentInfo) {
        console.log("ℹ️ 일반 가이드/리뷰형 주제이므로 출처 기재를 강제하지 않습니다.");
      }

      // 임시 객체 생성
      const rawPublication: Publication = {
        ...aiPost,
        platform: task.platform || "naver",
        category: task.category,
        createdAt: new Date().toISOString(),
      };
      
      console.log(`DEBUG [generatePost]: 최종 Publication 출처 개수: ${rawPublication.references?.length || 0}`);


      // 3. 🛡️ 안전 가이드라인 검수 및 강제 수정 (Sanitizer)
      onProgress?.("🛡️ 안전 가이드라인 검수 중...");
      const sanitizedPublication = sanitizeContent(rawPublication, task.topic);

      onProgress?.("포스팅 생성 완료");
      return sanitizedPublication;
    } catch (error: any) {
      console.error(`[GeneratePost] Error:`, error);
      lastError = error;

      // 429 에러(Quota Exceeded)인 경우 재시도하지 않고 즉시 상위로 던져서 모델 변경을 유도함
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("exhausted") ||
        errorMsg.includes("limit")
      ) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        // 지수 백오프 (Exponential Backoff)
        const waitTime = attempt * 2000;
        await delay(waitTime);
      }
    }
  }

  // 모든 재시도가 실패한 경우
  console.error("🚨 모든 AI 호출 재시도가 실패했습니다.");
  throw lastError;
}

