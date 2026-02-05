import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";
import { TavilyService } from "../services/tavilyService";
import { DbService } from "../services/dbService";

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
      onProgress?.("뉴스 캐시 확인 중...");
      const cachedNews = db.getRecentNews(task.topic);

      if (cachedNews) {
        onProgress?.("기존 뉴스 데이터 활용");
        newsContext = cachedNews.content;
        inputParams.latestNews = `[저장된 뉴스 데이터 활용]\n${cachedNews.content}`;
      } else {
        onProgress?.(`실시간 뉴스 검색 중: ${task.topic}`);
        const tavily = new TavilyService();
        newsContext = await tavily.searchLatestNews(inputParams.topic);

        inputParams.latestNews =
          newsContext ||
          "최신 뉴스 정보를 가져오지 못했습니다. 최대한 최신 정보를 제공해주세요";

        if (newsContext && newsContext.length > 50) {
          onProgress?.("검색 결과 캐시 저장 중...");
          db.saveNews(task.topic, newsContext, []);
        }
      }

      onProgress?.("AI 포스팅 초안 생성 중...");
      const aiPost = await generatePostSingleCall(client, inputParams);

      const publication: Publication = {
        ...aiPost,
        platform: task.platform || "naver",
        category: task.category,
        createdAt: new Date().toISOString(),
      };

      onProgress?.("포스팅 생성 완료");
      return publication;
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