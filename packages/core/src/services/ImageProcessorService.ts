import sharp from "sharp";
import path from "path";
import fs from "fs";

export interface ThumbnailOptions {
  title: string;
  category?: string;
  outputPath?: string;
}

/**
 * [v11.0] AI 썸네일 제너레이터 서비스
 * 이미지 위에 텍스트를 합성하여 고퀄리티 썸네일을 생성합니다.
 */
export class ImageProcessorService {
  /**
   * 이미지 위에 텍스트를 오버레이하여 썸네일을 생성합니다.
   * @param inputPath 원본 이미지 경로
   * @param options 썸네일 옵션 (제목, 카테고리 등)
   * @returns 생성된 이미지의 절대 경로
   */
  async generateThumbnail(inputPath: string, options: ThumbnailOptions): Promise<string> {
    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`원본 이미지를 찾을 수 없습니다: ${inputPath}`);
      }

      const metadata = await sharp(inputPath).metadata();
      const width = metadata.width || 1200;
      const height = metadata.height || 630;

      // 1. 반투명 검은색 배경 박스 (텍스트 가독성 확보)
      const overlaySvg = this.createTextSvg(options.title, options.category, width, height);
      
      const fileName = `thumb_${path.basename(inputPath)}`;
      const dirName = path.dirname(inputPath);
      const finalOutputPath = options.outputPath || path.join(dirName, fileName);

      await sharp(inputPath)
        .composite([
          {
            input: Buffer.from(overlaySvg),
            top: 0,
            left: 0,
          },
        ])
        .toFile(finalOutputPath);

      console.log(`✅ [ImageProcessor] 썸네일 생성 완료: ${finalOutputPath}`);
      return finalOutputPath;
    } catch (error: any) {
      console.error(`❌ [ImageProcessor] 썸네일 생성 실패: ${error.message}`);
      return inputPath; // 실패 시 원본 경로 반환
    }
  }

  /**
   * 텍스트와 배경 오버레이를 위한 SVG를 생성합니다.
   */
  private createTextSvg(title: string, category: string | undefined, width: number, height: number): string {
    // 제목 줄바꿈 처리 (너무 길면 자름)
    const displayTitle = title.length > 30 ? title.slice(0, 27) + "..." : title;
    const categoryText = category ? `#${category}` : "#BLOG";

    // 폰트 설정
    const fontFamily = "'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
            <feOffset dx="2" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.7" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        <!-- 중앙 반투명 어두운 오버레이 (문구 강조) -->
        <rect x="0" y="${height * 0.3}" width="${width}" height="${height * 0.4}" fill="black" fill-opacity="0.4" />

        <!-- 상단 키워드 (해시태그 스타일) -->
        <text x="50" y="80" font-family="${fontFamily}" font-size="32" font-weight="bold" fill="#03c75a" filter="url(#shadow)">
          ${this.escapeXml(categoryText)}
        </text>

        <!-- 중앙 강렬한 후킹 문구 -->
        <text x="50%" y="50%" font-family="${fontFamily}" font-size="64" font-weight="900" fill="white" text-anchor="middle" dominant-baseline="middle" filter="url(#shadow)">
          ${this.escapeXml(displayTitle)}
        </text>

        <!-- 데코레이션 라인 (상단) -->
        <rect x="50" y="100" width="100" height="6" fill="#03c75a" />
      </svg>
    `;
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&"']/g, (c) => {
      switch (c) {
        case "<": return "&lt;";
        case ">": return "&gt;";
        case "&": return "&amp;";
        case "\"": return "&quot;";
        case "'": return "&apos;";
        default: return c;
      }
    });
  }
}
