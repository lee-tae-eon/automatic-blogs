import axios from "axios";
import fs from "fs";
import path from "path";

export class UnsplashService {
  private accessKey: string = process.env.UNSPLASH_ACCESS_KEY!; // 발급받은 키 입력

  async downloadImage(
    keyword: string,
    saveDir: string,
    options: { width?: number; height?: number } = {},
  ): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://api.unsplash.com/photos/random`,
        {
          params: {
            query: keyword,
            client_id: this.accessKey,
            orientation: "landscape", // 가로형 이미지 우선 검색
          },
        },
      );

      // 리사이징을 위해 raw URL을 사용합니다.
      let imageUrl = response.data.urls.raw;
      
      // 기본값 또는 전달받은 옵션으로 이미지 크기 파라미터 추가
      const width = options.width || 1280;
      const height = options.height || 720;
      
      imageUrl += `&w=${width}&h=${height}&fit=crop&crop=entropy&q=80`;

      console.log(`   이미지 다운로드 중... (크기: ${width}x${height})`);

      const filePath = path.join(saveDir, `image_${Date.now()}.jpg`);

      const writer = fs.createWriteStream(filePath);
      const imageStream = await axios.get(imageUrl, { responseType: "stream" });

      imageStream.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => {
          console.log(`   ✅ 이미지 저장 완료: ${filePath}`);
          resolve(filePath);
        });
        writer.on("error", reject);
      });
    } catch (e: any) {
      console.error(
        "❌ Unsplash 이미지 다운로드 실패:",
        e.response?.data || e.message,
      );
      return null;
    }
  }
}
