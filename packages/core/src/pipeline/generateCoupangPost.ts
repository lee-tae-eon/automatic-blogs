import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";
import { DbService } from "../services/dbService";
import { CoupangScraperService } from "../services/CoupangScraperService";

/**
 * 🛡️ [Safety] 쿠팡 콘텐츠 안전 검수 및 강조 표시 (Sanitizer)
 */
function sanitizeCoupangContent(publication: Publication, topic: string): Publication {
  let { title, content } = publication;

  // 쿠팡 파트너스 강제 공정거래 문구 삽입 확인 및 치환
  // 프롬프트에서 `[쿠팡링크: 삽입위치]` 라고 반환한 부분을 실제 파트너스 링크 코드로 변경
  // generateCoupangPost 메인 함수에서 처리하지만 여기서 예비로 문단 정리
  const refineSpacing = (text: string): string => {
    return text.replace(/\n{4,}/g, "\n\n\n");
  };

  content = refineSpacing(content);
  return { ...publication, title, content };
}

export async function generateCoupangPost({
  client,
  task,
  projectRoot,
  onProgress,
}: GeneratePostInput): Promise<Publication> {
  const MAX_RETRIES = 1;
  let lastError: any;

  if (!task.coupangLink) {
    throw new Error("쿠팡 파트너스 링크가 제공되지 않았습니다.");
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(`상세정보 스크래핑 로봇 작동 중 (${attempt}/${MAX_RETRIES})`);

      // 1. 데이터 확보 (Coupang Scraper)
      const scraper = new CoupangScraperService();
      const productInfo = await scraper.scrapeProduct(task.coupangLink);

      // 상세 특징 합치기
      const featuresText = productInfo.features.length > 0 
        ? productInfo.features.map(f => `- ${f}`).join("\n")
        : "상세 스펙 설명 없음";

      const scrapedContext = `
# 상품 기본 정보
- 상품명: ${productInfo.title}
- 가격: ${productInfo.price}원

# 세부 특징 및 스펙
${featuresText}
      `.trim();

      const inputParams: BlogPostInput = {
        topic: task.topic,      
        persona: task.persona, // 고정됨 ("experiential")
        category: task.category,
        tone: task.tone,       // 고정됨 ("empathetic")
        keywords: [productInfo.title.substring(0, 15)],
        mode: task.mode || "manual",
        latestNews: scrapedContext, // 생성 프롬프트에 제공할 데이터
        coupangLink: task.coupangLink,
        extractedImages: productInfo.mainImages, 
      };

      const dbPath = projectRoot || process.cwd();
      const db = new DbService(dbPath);

      onProgress?.("가장 사람다운 리뷰 초안을 작성 중입니다...");
      const aiPost = await generatePostSingleCall(client, inputParams);

      // 쿠팡 파트너스 공정거래위원회 규정 의무 문구 
      // Rule 0, Rule 2를 만족하기 위해 가장 아래 또는 지정된 [쿠팡링크: 삽입위치]를 찾아 치환
      const coupangDisclaimer = `
<br/>
<hr/>
<div style="text-align: center; margin: 30px 0;">
  <a href="${task.coupangLink}" target="_blank" style="display: inline-block; padding: 15px 30px; background-color: #e63946; color: white; text-decoration: none; font-weight: bold; font-size: 1.1em; border-radius: 8px;">🛒 할인된 가격에 구매하기</a>
</div>
<p style="text-align: center; font-size: 0.9em; color: #888; font-style: italic;">
  이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
</p>
<br/>
`;

      if (aiPost.content.includes("[쿠팡링크: 삽입위치]")) {
        aiPost.content = aiPost.content.replace("[쿠팡링크: 삽입위치]", coupangDisclaimer);
      } else {
        aiPost.content += coupangDisclaimer;
      }

      // 출처 복구 (쿠팡은 출처가 없으므로 생략 가능, 초기화 유지)
      aiPost.references = [];

      const rawPublication: Publication = {
        ...aiPost,
        category: task.category,
        persona: task.persona,
        tone: task.tone,
        createdAt: new Date().toISOString(),
      };

      onProgress?.("🛡️ 공정거래 문구 검수 및 가독성 정리 중...");
      const sanitizedPublication = sanitizeCoupangContent(rawPublication, task.topic);

      db.savePost(task.topic, task.persona, task.tone, sanitizedPublication);

      onProgress?.("포스팅 생성 완료");
      return sanitizedPublication;
    } catch (error: any) {
      console.error(`[GenerateCoupangPost] Error:`, error);
      lastError = error;

      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("429")) throw error;
      if (attempt < MAX_RETRIES) await delay(attempt * 2000);
    }
  }
  throw lastError;
}
