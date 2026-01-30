import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class PexelsService {
  private apiKey: string;

  constructor() {
    this.apiKey = (process.env.PEXELS_API_KEY || "").trim();
    if (!this.apiKey) {
      console.warn("⚠️ PEXELS_API_KEY가 설정되지 않았습니다.");
    }
  }

  /**
   * 키워드를 파일명으로 안전하게 변환
   * 예: "삼성전자 주가" → "samsung-junga"
   */
  private sanitizeKeyword(keyword: string): string {
    return keyword
      .toLowerCase()
      .replace(/\s+/g, "-") // 공백을 하이픈으로
      .replace(/[^\w가-힣-]/g, "") // 특수문자 제거
      .substring(0, 50); // 최대 50자
  }

  /**
   * 키워드의 해시값 생성 (중복 방지용)
   */
  private getKeywordHash(keyword: string): string {
    return crypto
      .createHash("md5")
      .update(keyword.trim().toLowerCase())
      .digest("hex")
      .substring(0, 8);
  }

  /**
   * 캐시된 이미지가 있는지 확인
   */
  private findCachedImage(keyword: string, saveDir: string): string | null {
    const sanitized = this.sanitizeKeyword(keyword);
    const hash = this.getKeywordHash(keyword);

    // 가능한 파일명 패턴들
    const patterns = [
      `pexels_${sanitized}_${hash}.jpg`,
      `pexels_${sanitized}_${hash}.jpeg`,
      `pexels_${sanitized}_${hash}.png`,
    ];

    for (const pattern of patterns) {
      const filePath = path.join(saveDir, pattern);
      if (fs.existsSync(filePath)) {
        console.log(`✅ 캐시된 이미지 사용: ${pattern}`);
        return filePath;
      }
    }

    return null;
  }

  /**
   * Pexels에서 이미지 다운로드 (캐싱 적용)
   */
  async downloadImage(
    keyword: string,
    saveDir: string,
  ): Promise<string | null> {
    try {
      // 0. 저장 디렉토리 확인
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }

      // 1. 캐시 확인
      const cachedPath = this.findCachedImage(keyword, saveDir);
      if (cachedPath) {
        return cachedPath;
      }

      console.log(`🔍 Pexels 검색: "${keyword}"`);

      // 2. Pexels API 호출
      const response = await axios.get("https://api.pexels.com/v1/search", {
        params: {
          query: keyword,
          per_page: 1,
          orientation: "landscape",
        },
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!response.data.photos || response.data.photos.length === 0) {
        console.warn(`⚠️ Pexels: "${keyword}"에 대한 이미지가 없습니다.`);
        return null;
      }

      // 3. 이미지 URL 추출
      const photo = response.data.photos[0];
      const imageUrl = photo.src.large;

      // 4. 파일명 생성 (키워드 기반)
      const sanitized = this.sanitizeKeyword(keyword);
      const hash = this.getKeywordHash(keyword);
      const filePath = path.join(saveDir, `pexels_${sanitized}_${hash}.jpg`);

      // 5. 이미지 다운로드 및 저장
      console.log(`📥 다운로드 중: ${path.basename(filePath)}`);

      const writer = fs.createWriteStream(filePath);
      const imageResponse = await axios.get(imageUrl, {
        responseType: "stream",
      });

      imageResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(`✅ 저장 완료: ${path.basename(filePath)}`);
          resolve(filePath);
        });
        writer.on("error", (err) => {
          console.error(`❌ 저장 실패: ${err.message}`);
          reject(err);
        });
      });
    } catch (e) {
      console.error("❌ Pexels 이미지 처리 실패:", e);
      return null;
    }
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats(saveDir: string): {
    totalImages: number;
    totalSize: number;
    files: string[];
  } {
    if (!fs.existsSync(saveDir)) {
      return { totalImages: 0, totalSize: 0, files: [] };
    }

    const files = fs
      .readdirSync(saveDir)
      .filter(
        (f) =>
          f.startsWith("pexels_") &&
          (f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png")),
      );

    const totalSize = files.reduce((sum, file) => {
      const filePath = path.join(saveDir, file);
      const stats = fs.statSync(filePath);
      return sum + stats.size;
    }, 0);

    return {
      totalImages: files.length,
      totalSize,
      files,
    };
  }

  /**
   * 오래된 캐시 정리 (선택적)
   */
  cleanOldCache(saveDir: string, daysOld: number = 30): number {
    if (!fs.existsSync(saveDir)) {
      return 0;
    }

    const now = Date.now();
    const maxAge = daysOld * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    const files = fs
      .readdirSync(saveDir)
      .filter((f) => f.startsWith("pexels_"));

    for (const file of files) {
      const filePath = path.join(saveDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAge) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(
          `🗑️ 삭제: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))}일 전)`,
        );
      }
    }

    return deletedCount;
  }
}
