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

  // 2. 제목 강제 순화
  if (/자살/g.test(title) || /극단적 선택/g.test(title)) {
    console.warn("🛡️ [Safety] 제목의 금지어를 순화합니다.");
    title = title
      .replace(/자살/g, "사망")
      .replace(/극단적 선택/g, "비극적 사건")
      .replace(/충격/g, "속보");
    isModified = true;
  }

  // 3. 본문 강제 순화 및 뉴스 마커 정밀 제거 (Safe Mode)
  // [뉴스 1], (출처: BBC) 처럼 명확한 출처 표기만 제거하고, [1단계] 같은 건 유지
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

  // 4. [v3.4] 최신성 검수 (Year Correction)
  // AI가 과거 연도를 언급할 경우 현재 연도로 보정
  const currentYear = new Date().getFullYear().toString(); // 2026
  const outdatedYearsRegex = /202[3-5]년/g;
  if (outdatedYearsRegex.test(content) || outdatedYearsRegex.test(title)) {
    console.warn(`🕒 [Sanitizer] 과거 연도 감지됨. 2026년으로 수정을 시도합니다.`);
    title = title.replace(outdatedYearsRegex, `${currentYear}년`);
    content = content.replace(outdatedYearsRegex, `${currentYear}년`);
    isModified = true;
  }

  const oldContent = content;

  // 4. [v3.1] 모바일 가독성 강제 줄바꿈 (Smart Spacing)
  const enforceMobileSpacing = (text: string): string => {
    return text.split("\n").map(line => {
      if (line.match(/^(\s*[-*>]|\s*\d+\.|\||#)/)) return line;
      if (line.trim().length === 0) return line;
      return line.replace(/(\.|!|\?)\s+(?=[가-힣a-zA-Z])/g, "$1\n\n");
    }).join("\n");
  };

  // 5. [v3.2] 리얼 모바일 핏 (Real Mobile Fit) - 폭 좁게 쓰기
  const formatForMobile = (text: string): string => {
    return text.split("\n").map(line => {
      if (line.match(/^(\s*[-*>]|\s*\d+\.|\||#|\[)/)) return line;
      if (line.trim().length < 28) return line;

      const words = line.split(" ");
      let currentLine = "";
      let result = "";

      for (const word of words) {
        if ((currentLine + word).length > 28) {
          result += currentLine.trim() + "\n";
          currentLine = word + " ";
        } else {
          currentLine += word + " ";
        }
      }
      result += currentLine.trim();
      return result;
    }).join("\n");
  };

  content = formatForMobile(content);
  content = enforceMobileSpacing(content); 
  content = content.replace(/\n{3,}/g, "\n\n");

  if (content !== oldContent) {
    console.log("📱 [Mobile] 모바일 화면 폭에 맞춰 줄바꿈을 재배열했습니다.");
    isModified = true;
  }

  // 6. 상담 전화번호 강제 주입
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

      // ✅ 1-1. 포스트 캐시 확인 (정확히 일치하는 경우 재사용)
      const cachedPost = db.getCachedPost(task.topic, task.persona, task.tone);
      if (cachedPost) {
        onProgress?.("♻️ 기존에 생성된 콘텐츠가 있어 재사용합니다.");
        // 캐시된 데이터 반환 (createdAt 등은 최신으로 갱신하지 않고 그대로 유지하거나, 필요 시 갱신)
        return cachedPost; 
      }

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
        
        // 🔍 검색어 정제 및 2026년 최신성 강제
        let cleanTopic = task.topic.split("\n")[0].trim();
        let searchQuery = `${cleanTopic} 2026년 최신 정보`; // 현재 연도 명시
        
        // 장소 관련 주제인 경우 검색어 보강
        if (topicIntent.isPlace) {
          searchQuery = `${cleanTopic} 정확한 위치 상호명 메뉴 가격 정보`;
          onProgress?.(`장소 데이터 정밀 검색 중: ${cleanTopic}`);
        } else if (task.persona === "hollywood-reporter") {
          // 헐리우드 특파원인 경우 영어 소스 검색 강화
          searchQuery = `${cleanTopic} latest news gossip tmz people dailymail`;
          onProgress?.(`🎬 헐리우드 현지 뉴스 검색 중: ${cleanTopic}`);
        } else {
          onProgress?.(`실시간 정보 검색 중: ${cleanTopic}`);
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
        category: task.category,
        persona: task.persona,
        tone: task.tone,
        createdAt: new Date().toISOString(),
      };
      
      console.log(`DEBUG [generatePost]: 최종 Publication 출처 개수: ${rawPublication.references?.length || 0}`);


      // 3. 🛡️ 안전 가이드라인 검수 및 강제 수정 (Sanitizer)
      onProgress?.("🛡️ 안전 가이드라인 검수 중...");
      const sanitizedPublication = sanitizeContent(rawPublication, task.topic);

      // ✅ 4. 결과 캐싱 (DB 저장)
      db.savePost(task.topic, task.persona, task.tone, sanitizedPublication);

      onProgress?.("포스팅 생성 완료");
      return sanitizedPublication;
    } catch (error: any) {
      console.error(`[GeneratePost] Error:`, error);
      lastError = error;

      // 🚨 에러 발생 시 뉴스 캐시 무효화 (다음 시도 시 깨끗한 상태로 검색)
      try {
        const dbPath = projectRoot || process.cwd();
        const db = new DbService(dbPath);
        console.warn(`⚠️ [GeneratePost] 에러 발생으로 인해 '${task.topic}'의 뉴스 캐시를 삭제합니다.`);
        db.deleteNews(task.topic);
      } catch (dbError) {
        console.error("❌ 뉴스 캐시 삭제 실패:", dbError);
      }

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

