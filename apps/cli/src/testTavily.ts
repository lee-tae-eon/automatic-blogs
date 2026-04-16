import { TavilyService } from "@blog-automation/core";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function testYoutubeSearch() {
  const tavily = new TavilyService();
  const topic = "KB금융 신한지주 배당금 ISA 연금저축";
  
  console.log(`\n🔍 [TEST] 유튜브 검색 테스트 시작: "${topic}"`);
  
  try {
    const videoCandidates = await tavily.searchYoutubeVideo(topic);
    if (videoCandidates.length > 0) {
      console.log(`✅ ${videoCandidates.length}개의 영상 후보 발견!`);
      videoCandidates.forEach((video, i) => {
        console.log(`[${i + 1}] 제목: ${video.title} / URL: ${video.url}`);
      });
    } else {
      console.warn(`⚠️ 검색 결과가 없습니다.`);
    }
  } catch (error) {
    console.error(`❌ 테스트 중 치명적 오류 발생:`, error);
  }
}

testYoutubeSearch();
