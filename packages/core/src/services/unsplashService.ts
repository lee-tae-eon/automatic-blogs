import axios from "axios";
import fs from "fs";
import path from "path";

export class UnsplashService {
  private accessKey: string = process.env.UNSPLASH_ACCESS_KEY!; // 발급받은 키 입력

  async downloadImage(
    keyword: string,
    saveDir: string,
  ): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://api.unsplash.com/photos/random`,
        {
          params: { query: keyword, client_id: this.accessKey },
        },
      );

      const imageUrl = response.data.urls.regular;
      const filePath = path.join(saveDir, `image_${Date.now()}.jpg`);

      const writer = fs.createWriteStream(filePath);
      const imageStream = await axios.get(imageUrl, { responseType: "stream" });

      imageStream.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(filePath));
        writer.on("error", reject);
      });
    } catch (e) {
      console.error("Unsplash 다운로드 실패:", e);
      return null;
    }
  }
}
