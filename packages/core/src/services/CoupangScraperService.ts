import { chromium, Page } from "playwright";

export interface CoupangProductInfo {
  title: string;
  price: string;
  originalPrice?: string;
  discountRate?: string;
  rating?: string;
  reviewCount?: string;
  features: string[]; // 상품 주요 특장점
  mainImages: string[]; // 대표 이미지 URL들 (최대 3개 정도)
}

export class CoupangScraperService {
  /**
   * 주어진 쿠팡 파트너스 단축 링크 혹은 일반 상품 링크에 접속하여
   * 리뷰 작성에 필요한 핵심 상품 데이터를 추출합니다.
   */
  async scrapeProduct(url: string): Promise<CoupangProductInfo> {
    console.log(`🚀 [CoupangScraper] 스크래핑 시작: ${url}`);
    const browser = await chromium.launch({
      headless: true, // 안티봇 우회를 위해 필요시 false로 테스트
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    try {
      // 1. 페이지 접속 (리디렉션 추적 대비 대기)
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000); // 리디렉션 등 안정화 

      // 쿠팡 안티봇(Captcha 등) 감지 로직 최소화 처리 필요시 여기에 추가
      if (page.url().includes("captcha")) {
         console.warn("⚠️ [CoupangScraper] CAPTCHA 감지됨. 부분적 정보만 수집될 수 있습니다.");
      }

      // 2. 제목 추출
      const title = await page.evaluate(() => {
        const el = document.querySelector(".prod-buy-header__title");
        return el ? (el.textContent || "").trim() : "상품명 조회 불가";
      });

      // 3. 가격 추출 (할인 가격 우선, 없으면 원가)
      const price = await page.evaluate(() => {
         const discountEl = document.querySelector("span.total-price > strong");
         const normalEl = document.querySelector("span.origin-price");
         if (discountEl) return (discountEl.textContent || "").replace(/[^0-9]/g, "");
         if (normalEl) return (normalEl.textContent || "").replace(/[^0-9]/g, "");
         return "가격 정보 없음";
      });

      // 4. 주요 특장점 (Feature 리스트) 추출
      const features = await page.evaluate(() => {
        const items = document.querySelectorAll(".prod-description-attribute li");
        return Array.from(items).map(li => (li.textContent || "").trim()).filter(t => t);
      });

      // 5. 대표 이미지 추출 (prod-image__item 목록 기준 등)
      const mainImages = await page.evaluate(() => {
         const imgNodes = document.querySelectorAll(".prod-image__item img");
         const urls: string[] = [];
         
         Array.from(imgNodes).forEach(img => {
            let src = img.getAttribute("src") || img.getAttribute("data-src") || "";
            // 스크롤 레이지 로드 방어
            if(src.includes("blank.gif") && img.hasAttribute("data-src")) {
                src = img.getAttribute("data-src") || "";
            }

            if (src) {
                // 해상도 조절 (보통 쿠팡 썸네일은 크기가 고정되어 있으므로 원본화 전략 고려)
                // 예: /image/vendor_inventory/...
                if (src.startsWith("//")) src = "https:" + src;
                urls.push(src);
            }
         });
         
         // 중복 제거 후 최대 3장만 리턴
         return Array.from(new Set(urls)).slice(0, 3);
      });

      console.log(`✅ [CoupangScraper] 스크래핑 성공: ${title.substring(0, 15)}...`);
      return {
        title,
        price,
        features,
        mainImages,
      };
    } catch (e: any) {
      console.error("❌ [CoupangScraper] 스크래핑 오류:", e);
      throw new Error(`쿠팡 데이터 스크래핑 실패: ${e.message}`);
    } finally {
      await browser.close();
    }
  }
}
