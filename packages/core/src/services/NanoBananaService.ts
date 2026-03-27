import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * 🍌 NanoBanana Service (Gemini Imagen 3 Integration)
 * 블로그의 이질감을 없애고 시선을 끄는 고품질 AI 이미지를 생성합니다.
 */
export class NanoBananaService {
  private readonly apiKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/imagen-3:predict";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * 주제에 맞는 고품질 이미지를 생성하여 로컬에 저장합니다.
   * @param prompt 이미지 생성 프롬프트
   * @param saveDir 저장 디렉토리
   */
  async generatePremiumImage(prompt: string, saveDir: string): Promise<string | null> {
    console.log(`🍌 [NanoBanana] 프리미엄 이미지 생성 시작: [${prompt}]`);
    
    try {
      // Imagen 3 API 호출 (Google Cloud 또는 AI Studio API 키 필요)
      // 참고: 현재 공식 라이브러리(@google/generative-ai)에서 직접 지원하지 않을 경우 REST API로 호출
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          instances: [
            {
              prompt: `A high-quality, professional, and visually stunning blog header image for: "${prompt}". Artistic, modern, and clean aesthetic, cinematic lighting, 8k resolution, photorealistic.`,
            },
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: "16:9",
          },
        },
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      const prediction = response.data.predictions?.[0];
      if (!prediction || !prediction.bytesBase64Encoded) {
        console.warn("⚠️ [NanoBanana] 이미지 생성 응답에 데이터가 없습니다.");
        return null;
      }

      // Base64 데이터를 파일로 저장
      const buffer = Buffer.from(prediction.bytesBase64Encoded, "base64");
      const fileName = `nanobanana_${Date.now()}.png`;
      const filePath = path.join(saveDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ [NanoBanana] 이미지 생성 및 저장 완료: ${filePath}`);
      
      return filePath;
    } catch (error: any) {
      console.error("❌ [NanoBanana] 이미지 생성 중 오류:", error.response?.data || error.message);
      return null;
    }
  }
}

/**
 * 🚀 AntiGravity Bridge Service
 * 외부 앱(안티그래비티)과 연동하여 동적으로 생성된 이미지를 가져옵니다.
 */
export class AntiGravityBridge {
  private readonly watchPath: string;

  constructor() {
    // 사용자가 지정한 안티그래비티 이미지 출력 경로 (Desktops)
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    this.watchPath = path.join(homeDir, "Desktops", "blogcategoryinfoimage");
    
    if (!fs.existsSync(this.watchPath)) {
      try {
        // Desktops 폴더가 없을 경우를 대비해 생성 시도 (보통은 Desktop이지만 사용자의 요청을 따름)
        fs.mkdirSync(this.watchPath, { recursive: true });
      } catch (e) {
        // 실패 시 일반 Desktop으로 폴백 시도
        this.watchPath = path.join(homeDir, "Desktop", "blogcategoryinfoimage");
        if (!fs.existsSync(this.watchPath)) {
           fs.mkdirSync(this.watchPath, { recursive: true });
        }
      }
    }
  }

  /**
   * 안티그래비티 앱에서 가장 최근에 생성된 이미지를 가져옵니다.
   */
  async getLatestDynamicImage(): Promise<string | null> {
    try {
      const files = fs.readdirSync(this.watchPath)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map(f => ({
          name: f,
          time: fs.statSync(path.join(this.watchPath, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 0) {
        const latestFile = path.join(this.watchPath, files[0].name);
        console.log(`🚀 [AntiGravity] 동적 이미지 발견: ${latestFile}`);
        return latestFile;
      }
      
      return null;
    } catch (error) {
      console.error("❌ [AntiGravity] 이미지 확인 중 오류:", error);
      return null;
    }
  }
}
