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
}: GeneratePostInput): Promise<Publication> {
  const MAX_RETRIES = 1; // 최대 1번 재시도 (API 비용 절약)
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🤖 AI 포스팅 생성 시도 중... (${attempt}/${MAX_RETRIES})`);

      const inputParams: BlogPostInput = {
        topic: task.topic,
        persona: task.persona,
        category: task.category,
        tone: task.tone,
        ...(task.keywords && { keywords: task.keywords }),
      };

      // 1. DB 서비스 초기화
      // projectRoot가 없으면(테스트 환경 등) 현재 폴더 사용
      const dbPath = projectRoot || process.cwd();
      console.log(`📂 DB 경로 초기화: ${dbPath}`);
      const db = new DbService(dbPath);

      // 2. 뉴스 데이터 확보 (Cache-First 전략)
      let newsContext = "";

      // (1) DB 캐시 확인 (24시간 이내 데이터)
      const cachedNews = db.getRecentNews(task.topic);

      if (cachedNews) {
        console.log(
          `✅ [DB] 캐시 히트! Tavily 검색을 건너뜁니다. (Topic: ${task.topic})`,
        );
        newsContext = cachedNews.content;

        // 캐시된 데이터임을 명시 (프롬프트에 힌트 제공)
        inputParams.latestNews = `[저장된 뉴스 데이터 활용]\n${cachedNews.content}`;
      } else {
        // (2) 캐시가 없으면 Tavily 실시간 검색 수행
        console.log(
          `🌐 [Tavily] 캐시 없음. 실시간 뉴스 검색 시작: ${inputParams.topic}`,
        );
        const tavily = new TavilyService();

        // searchLatestNews가 string을 반환한다고 가정
        newsContext = await tavily.searchLatestNews(inputParams.topic);

        inputParams.latestNews =
          newsContext ||
          "최신 뉴스 정보를 가져오지 못했습니다. 최대한 최신 정보를 제공해주세요";

        // (3) 검색 결과가 유의미하면 DB에 저장 (다음 번을 위해)
        if (newsContext && newsContext.length > 50) {
          console.log("💾 [DB] 검색된 뉴스 데이터 저장 시도...");
          // TavilyService에서 URL을 따로 안 준다면 빈 배열 [] 처리
          db.saveNews(task.topic, newsContext, []);
        } else {
          console.warn(
            "⚠️ [DB] 검색 결과가 비어있거나 너무 짧아 저장하지 않습니다.",
          );
        }
      }

      console.log(
        `🤖 [2/3] AI 포스팅 생성 중... (News Context Length: ${newsContext.length})`,
      );

      // 3. AI 호출 (프롬프트 생성 및 요청)
      const aiPost = await generatePostSingleCall(client, inputParams);

      const publication: Publication = {
        ...aiPost,
        platform: task.platform || "naver",
        category: task.category,
        createdAt: new Date().toISOString(),
      };

      return publication; // 성공 시 즉시 반환
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ 생성 실패 (시도 ${attempt}):`,
        error instanceof Error ? error.message : error,
      );

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
        console.log(`⏱️ ${waitTime / 1000}초 후 다시 시도합니다...`);
        await delay(waitTime);
      }
    }
  }

  // 모든 재시도가 실패한 경우
  console.error("🚨 모든 AI 호출 재시도가 실패했습니다.");
  throw lastError;
}

// import { delay } from "../util/delay";
// import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
// import { generatePostSingleCall } from "./generatePostSingleCall";
// import { TavilyService } from "../services/tavilyService";
// import { DbService } from "../services/dbService";

// /**
//  * @description ai client 로 부터 post 를 반환하는 함수
//  * @param param0
//  * @returns
//  */
// export async function generatePost({
//   client,
//   task,
//   projectRoot,
// }: GeneratePostInput): Promise<Publication> {
//   const MAX_RETRIES = 1; // 최대 3번 재시도
//   let lastError: any;

//   for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
//     try {
//       console.log(`🤖 AI 포스팅 생성 시도 중... (${attempt}/${MAX_RETRIES})`);

//       const inputParams: BlogPostInput = {
//         topic: task.topic,
//         persona: task.persona,
//         category: task.category,
//         tone: task.tone,

//         ...(task.keywords && { keywords: task.keywords }),
//       };

//       // 1. DB 서비스 초기화
//       // projectRoot가 없으면(테스트 환경 등) 현재 폴더 사용
//       const dbPath = projectRoot || process.cwd();
//       console.log(`📂 DB 경로 초기화: ${dbPath}`);
//       const db = new DbService(dbPath);

//       // 1. Tavily를 통한 실시간 뉴스 검색
//       console.log(
//         `\n🔍 [1/3] 최신 뉴스 데이터 수집 시작: ${inputParams.topic}`,
//       );
//       const tavily = new TavilyService();
//       const newsContext = await tavily.searchLatestNews(inputParams.topic);
//       inputParams.latestNews =
//         newsContext ||
//         "최신 뉴스 정보를 가져오지 못했습니다. 최대한 최신 정보를 제공해주세요";

//       console.log(
//         `🤖 [2/3] AI 포스팅 생성 중... (News Context: ${newsContext ? "연동됨" : "미연동"})`,
//       );

//       const aiPost = await generatePostSingleCall(client, inputParams);

//       const publication: Publication = {
//         ...aiPost,
//         platform: task.platform || "naver",
//         category: task.category,
//         createdAt: new Date().toISOString(),
//       };

//       return publication; // 성공 시 즉시 반환
//     } catch (error) {
//       lastError = error;
//       console.warn(
//         `⚠️ 생성 실패 (시도 ${attempt}):`,
//         error instanceof Error ? error.message : error,
//         error instanceof Error ? error.name : error,
//       );

//       // 429 에러(Quota Exceeded)인 경우 재시도하지 않고 즉시 상위로 던져서 모델 변경을 유도함
//       const errorMsg = error instanceof Error ? error.message : String(error);
//       if (
//         errorMsg.includes("429") ||
//         errorMsg.includes("Too Many Requests") ||
//         errorMsg.includes("exhausted")
//       ) {
//         throw error;
//       }

//       if (attempt < MAX_RETRIES) {
//         // 다음 시도 전 대기 (재시도 횟수가 늘어날수록 더 오래 대기하는 '지수 백오프' 전략)
//         const waitTime = attempt * 2000;
//         console.log(`⏱️ ${waitTime / 1000}초 후 다시 시도합니다...`);
//         await delay(waitTime);
//       }
//     }
//   }

//   // 모든 재시도가 실패한 경우
//   console.error("🚨 모든 AI 호출 재시도가 실패했습니다.");
//   throw lastError;
// }
