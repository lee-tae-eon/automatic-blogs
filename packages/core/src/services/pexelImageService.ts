import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class PexelsService {
  private apiKey: string;
  private readonly API_URL = "https://api.pexels.com/v1/search";

  constructor() {
    // ✅ Electron 실행 시 .env 로딩 실패를 대비해 공백 제거 및 확인 로직 강화
    this.apiKey = (process.env.PEXELS_API_KEY || "").trim();

    if (!this.apiKey) {
      console.error(
        "❌ [PexelsService] API Key가 없습니다. .env 파일이나 환경변수를 확인하세요.",
      );
    }
  }

  private sanitizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w가-힣-]/g, "")
      .substring(0, 50);
  }

  private getKeywordHash(keyword: string): string {
    return crypto
      .createHash("md5")
      .update(keyword.trim().toLowerCase())
      .digest("hex")
      .substring(0, 8);
  }

  private findCachedImage(keyword: string, saveDir: string): string | null {
    const sanitized = this.sanitizeKeyword(keyword);
    const hash = this.getKeywordHash(keyword);
    const patterns = [
      `pexels_${sanitized}_${hash}.jpg`,
      `pexels_${sanitized}_${hash}.jpeg`,
      `pexels_${sanitized}_${hash}.png`,
    ];

    for (const pattern of patterns) {
      const filePath = path.join(saveDir, pattern);
      if (fs.existsSync(filePath)) return filePath;
    }
    return null;
  }

  async downloadImage(
    keyword: string,
    saveDir: string,
  ): Promise<string | null> {
    // ✅ 검색어가 너무 짧거나 의미 없는 수식어면 시도하지 않음
    if (
      !keyword ||
      keyword.length < 2 ||
      /결론|따라서|하지만|이런|저런/i.test(keyword)
    ) {
      console.log(`   ⏭️ 검색어 부적절로 이미지 스킵: [${keyword}]`);
      return null;
    }

    if (!this.apiKey) return null;

    try {
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

      const cachedPath = this.findCachedImage(keyword, saveDir);
      if (cachedPath) return cachedPath;

      console.log(`🔍 Pexels API 호출: [${keyword}]`);

      const response = await axios.get(this.API_URL, {
        params: { query: keyword, per_page: 1, orientation: "landscape" },
        headers: { Authorization: this.apiKey },
        timeout: 5000,
      });

      if (!response.data.photos?.length) {
        console.warn(`⚠️ Pexels: [${keyword}] 결과 없음`);
        return null;
      }

      const imageUrl = response.data.photos[0].src.large;
      const filePath = path.join(
        saveDir,
        `pexels_${this.sanitizeKeyword(keyword)}_${this.getKeywordHash(keyword)}.jpg`,
      );

      const writer = fs.createWriteStream(filePath);
      const imageResponse = await axios.get(imageUrl, {
        responseType: "stream",
      });
      imageResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", (err) => {
          writer.close();
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          reject(err);
        });
      });
    } catch (e: any) {
      console.error("❌ Pexels 처리 실패:", e.response?.data || e.message);
      return null;
    }
  }
}
