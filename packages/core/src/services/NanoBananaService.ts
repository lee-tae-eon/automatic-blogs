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
    
    if (!this.apiKey || this.apiKey.length < 10) {
      console.error("❌ [NanoBanana] Gemini API Key가 유효하지 않습니다. 이미지 생성을 건너뜁니다.");
      return null;
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}?key=${this.apiKey}`,
        {
          instances: [
            {
              prompt: `A high-quality, professional, and visually stunning blog header image for: "${prompt}". Artistic, modern, and clean aesthetic, cinematic lighting, 8k resolution, photorealistic. No text, only high quality image.`,
            },
          ],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1", // 안정성을 위해 1:1 시도 (필요시 조절)
          },
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 20000 // 20초 타임아웃
        }
      );

      const prediction = response.data.predictions?.[0];
      if (!prediction || (!prediction.bytesBase64Encoded && !prediction.mimeType)) {
        console.warn("⚠️ [NanoBanana] 이미지 생성 응답에 유효한 데이터가 없습니다.", JSON.stringify(response.data).slice(0, 500));
        return null;
      }

      const base64Data = prediction.bytesBase64Encoded || prediction.image?.bytesBase64Encoded;
      if (!base64Data) {
         console.warn("⚠️ [NanoBanana] Base64 데이터를 찾을 수 없습니다.");
         return null;
      }

      // Base64 데이터를 파일로 저장
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `nanobanana_${Date.now()}.png`;
      const filePath = path.join(saveDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ [NanoBanana] 이미지 생성 및 저장 완료: ${filePath}`);
      
      return filePath;
    } catch (error: any) {
      console.error("❌ [NanoBanana] 이미지 생성 중 오류:");
      if (error.response) {
        console.error(`   - Status: ${error.response.status}`);
        console.error(`   - Data: ${JSON.stringify(error.response.data)}`);
      } else {
        console.error(`   - Message: ${error.message}`);
      }
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
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    
    // 가능한 모든 경로 후보군 (순서대로 확인)
    const candidates = [
      path.join(homeDir, "Desktop", "blogcategoryinfoimage"),
      path.join(homeDir, "Desktops", "blogcategoryinfoimage"),
      path.join(process.cwd(), "blogcategoryinfoimage"), // 현재 작업 디렉토리 폴백
    ];

    let foundPath = candidates[0];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    this.watchPath = foundPath;
    console.log(`🚀 [AntiGravity] 감시 경로 설정: ${this.watchPath}`);
    
    if (!fs.existsSync(this.watchPath)) {
      try {
        fs.mkdirSync(this.watchPath, { recursive: true });
        console.log(`🚀 [AntiGravity] 새로운 경로 생성됨: ${this.watchPath}`);
      } catch (e) {
        console.warn(`⚠️ [AntiGravity] 경로 생성 권한 부족: ${this.watchPath}`);
      }
    }
  }

  /**
   * 안티그래비티 앱에서 가장 최근에 생성된 이미지를 가져옵니다.
   */
  async getLatestDynamicImage(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.watchPath)) return null;

      const files = fs.readdirSync(this.watchPath)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .map(f => ({
          name: f,
          fullPath: path.join(this.watchPath, f),
          time: fs.statSync(path.join(this.watchPath, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 0) {
        const latestFile = files[0].fullPath;
        console.log(`✅ [AntiGravity] 최신 이미지 발견: ${files[0].name}`);
        return latestFile;
      }
      
      console.warn(`⚠️ [AntiGravity] 폴더에 유효한 이미지가 없습니다: ${this.watchPath}`);
      return null;
    } catch (error) {
      console.error("❌ [AntiGravity] 이미지 스캔 중 오류:", error);
      return null;
    }
  }
}
