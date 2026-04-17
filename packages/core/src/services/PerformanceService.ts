import { chromium, Browser, Page } from "playwright";
import { DbService } from "./dbService";

export interface PostMetrics {
  views: number;
  likes: number;
  comments: number;
}

/**
 * [v11.9] 블로그 성과 데이터 수집 서비스
 * 발행된 포스팅의 실제 조회수, 공감수 등을 크롤링하여 DB에 업데이트합니다.
 */
export class PerformanceService {
  constructor(private db: DbService) {}

  /**
   * 특정 URL의 성과 데이터를 수집하여 DB를 업데이트합니다.
   */
  async trackPostPerformance(url: string, headless: boolean = true): Promise<PostMetrics | null> {
    console.log(`📊 [Performance] 성과 데이터 수집 중: ${url}`);
    
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({ headless });
      const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      });
      const page = await context.newPage();

      let metrics: PostMetrics | null = null;

      if (url.includes("blog.naver.com")) {
        metrics = await this.scrapeNaverBlog(page, url);
      } else if (url.includes("tistory.com")) {
        metrics = await this.scrapeTistoryBlog(page, url);
      }

      if (metrics) {
        console.log(`✅ [Performance] 수집 완료: 조회수 ${metrics.views}, 공감 ${metrics.likes}, 댓글 ${metrics.comments}`);
        this.db.updatePostMetrics(url, metrics);
        return metrics;
      }

      return null;
    } catch (error) {
      console.error(`❌ [Performance] 데이터 수집 실패:`, error);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  /**
   * 네이버 블로그 성과 수집 (모바일 뷰 활용)
   */
  private async scrapeNaverBlog(page: Page, url: string): Promise<PostMetrics | null> {
    // 네이버 블로그는 PC 뷰에서 iframe을 사용하므로 모바일 URL로 변환하여 접근하는 것이 용이함
    const mobileUrl = url.replace("blog.naver.com", "m.blog.naver.com");
    await page.goto(mobileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    try {
      // 조회수 (네이버 모바일은 .count_view 또는 .view_count 클래스 등 사용)
      // 실제 셀렉터는 네이버의 정책에 따라 변할 수 있으므로 여러 후보를 시도
      const viewsText = await page.locator(".count_view, .view_count, .u_cnt").first().innerText().catch(() => "0");
      const likesText = await page.locator(".u_cnt_heart, .item_sympathy .u_cnt").first().innerText().catch(() => "0");
      const commentsText = await page.locator(".u_cnt_comment, .item_comment .u_cnt").first().innerText().catch(() => "0");

      return {
        views: this.parseNumber(viewsText),
        likes: this.parseNumber(likesText),
        comments: this.parseNumber(commentsText)
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 티스토리 블로그 성과 수집
   */
  private async scrapeTistoryBlog(page: Page, url: string): Promise<PostMetrics | null> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    try {
      // 티스토리는 스킨마다 셀렉터가 다르지만 공통적인 메타 태그나 기본 클래스 시도
      const viewsText = await page.locator(".revenue_unit_info .count, .view_count").first().innerText().catch(() => "0");
      const likesText = await page.locator(".u_cnt, .empathy_count").first().innerText().catch(() => "0");
      const commentsText = await page.locator(".comment_count, .count_comment").first().innerText().catch(() => "0");

      return {
        views: this.parseNumber(viewsText),
        likes: this.parseNumber(likesText),
        comments: this.parseNumber(commentsText)
      };
    } catch (e) {
      return null;
    }
  }

  private parseNumber(text: string): number {
    if (!text) return 0;
    // '1.2k', '1,000' 등 처리
    const clean = text.replace(/[^0-9.kK]/g, "").toLowerCase();
    if (clean.includes("k")) {
      return parseFloat(clean.replace("k", "")) * 1000;
    }
    return parseInt(clean) || 0;
  }
}
