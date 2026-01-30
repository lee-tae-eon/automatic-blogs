import axios from "axios";
import fs from "fs";
import path from "path";

export class PexelsService {
  private apiKey: string = `${process.env.PIXEL_API_KEY}`; // 발급받은 키 입력

  async downloadImage(
    keyword: string,
    saveDir: string,
  ): Promise<string | null> {
    try {
      // 1. Pexels 이미지 검색 (한글 키워드도 지원하지만, 영문 쿼리가 더 정확할 수 있음)
      const response = await axios.get(`${process.env.PIXEL_ENDPINT}`, {
        params: {
          query: keyword,
          per_page: 1,
          orientation: "landscape", // 블로그용 가로 이미지 권장
        },
        headers: {
          Authorization: this.apiKey,
        },
      });

      if (!response.data.photos || response.data.photos.length === 0) {
        console.warn(`⚠️ Pexels: "${keyword}"에 대한 이미지가 없습니다.`);
        return null;
      }

      // 2. 고화질 이미지 URL 추출 (large 또는 medium 추천)
      const imageUrl = response.data.photos[0].src.large;
      const filePath = path.join(saveDir, `pexels_${Date.now()}.jpg`);

      // 3. 이미지 다운로드 및 저장
      const writer = fs.createWriteStream(filePath);
      const imageResponse = await axios.get(imageUrl, {
        responseType: "stream",
      });

      imageResponse.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
      });
    } catch (e) {
      console.error("❌ Pexels 이미지 처리 실패:", e);
      return null;
    }
  }
}
