import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export class PexelsService {
  private apiKey: string;
  private readonly API_URL = "https://api.pexels.com/v1/search";

  constructor() {
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
      if (fs.existsSync(filePath)) {
        console.log(`   ✅ 캐시 사용: ${pattern}`);
        return filePath;
      }
    }
    return null;
  }

  async downloadImage(
    keyword: string,
    saveDir: string,
  ): Promise<string | null> {
    // ✅ 검색어 유효성 검사
    if (
      !keyword ||
      keyword.length < 2 ||
      /결론|따라서|하지만|이런|저런/i.test(keyword)
    ) {
      console.log(`   ⏭️ 검색어 부적절로 이미지 스킵: [${keyword}]`);
      return null;
    }

    if (!this.apiKey) {
      console.error("   ❌ Pexels API Key 없음");
      return null;
    }

    try {
      // 디렉토리 생성
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }

      // 캐시 확인
      const cachedPath = this.findCachedImage(keyword, saveDir);
      if (cachedPath) return cachedPath;

      console.log(`   🔍 Pexels API 호출: [${keyword}]`);

      // API 호출
      const response = await axios.get(this.API_URL, {
        params: {
          query: keyword,
          per_page: 1,
          orientation: "landscape",
        },
        headers: { Authorization: this.apiKey },
        timeout: 5000,
      });

      // 결과 확인
      if (!response.data.photos?.length) {
        console.warn(`   ⚠️ Pexels: [${keyword}] 결과 없음`);
        return null;
      }

      const imageUrl = response.data.photos[0].src.large;
      const filePath = path.join(
        saveDir,
        `pexels_${this.sanitizeKeyword(keyword)}_${this.getKeywordHash(keyword)}.jpg`,
      );

      console.log(`   📥 이미지 다운로드 중...`);

      // ✅ 개선: Stream 다운로드를 Promise로 확실하게 처리
      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);

        axios
          .get(imageUrl, {
            responseType: "stream",
            timeout: 10000, // ✅ 다운로드 타임아웃 추가
          })
          .then((imageResponse) => {
            imageResponse.data.pipe(writer);

            // ✅ 모든 이벤트 핸들러 등록
            writer.on("finish", () => {
              writer.close(); // ✅ 명시적으로 close
              console.log(`   ✅ 다운로드 완료: ${path.basename(filePath)}`);
              resolve();
            });

            writer.on("error", (err) => {
              writer.close();
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
              console.error(`   ❌ 파일 쓰기 오류:`, err);
              reject(err);
            });

            // ✅ Stream 에러 처리
            imageResponse.data.on("error", (err: Error) => {
              writer.close();
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
              }
              console.error(`   ❌ 스트림 오류:`, err);
              reject(err);
            });
          })
          .catch((err) => {
            writer.close();
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            console.error(`   ❌ 이미지 요청 실패:`, err.message);
            reject(err);
          });
      });

      // ✅ 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        console.error(`   ❌ 파일 생성 실패: ${filePath}`);
        return null;
      }

      // ✅ 파일 크기 확인
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        console.error(`   ❌ 빈 파일 생성됨, 삭제`);
        fs.unlinkSync(filePath);
        return null;
      }

      console.log(`   ✅ 완료: ${stats.size} bytes`);
      return filePath;
    } catch (e: any) {
      console.error("   ❌ Pexels 처리 실패:", e.response?.data || e.message);
      return null;
    }
  }

  /**
   * 캐시 통계
   */
  getCacheStats(saveDir: string) {
    if (!fs.existsSync(saveDir)) {
      return { totalImages: 0, totalSize: 0, files: [] };
    }

    const files = fs
      .readdirSync(saveDir)
      .filter((f) => f.startsWith("pexels_") && /\.(jpg|jpeg|png)$/.test(f));

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
   * 오래된 캐시 정리
   */
  cleanOldCache(saveDir: string, daysOld: number = 30): number {
    if (!fs.existsSync(saveDir)) return 0;

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
