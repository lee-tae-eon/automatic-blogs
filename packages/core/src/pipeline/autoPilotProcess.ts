import { KeywordScoutService, ScoutConfig } from "../services/KeywordScoutService";
import { TopicExpanderService } from "../services/TopicExpanderService";
import { CompetitorAnalyzerService } from "../services/CompetitorAnalyzerService";
import { generatePost } from "./generatePost";
import { markdownToHtml } from "../util/markdownToHtml";
import { IBlogPublisher } from "../publisher/interface";
import { NaverPublisher } from "../publisher/naverPub";
import { TistoryPublisher } from "../publisher/tistoryPub";
import { BatchTask } from "../types/blog";

export interface AutoPilotOptions {
  broadTopic: string; // 이제 구체적인 키워드가 아닌 '주제'를 받습니다.
  config: ScoutConfig;
  userDataPath: string;
  geminiClient: any;
  publishPlatforms: ("naver" | "tistory")[];
  credentials: {
    naver?: { id: string; pw: string };
    tistory?: { id: string; pw: string };
  };
  headless?: boolean;
  onProgress?: (message: string) => void;
}

/**
 * v2.0 Autonomous Auto-Pilot Pipeline
 * 주제 확장 -> 키워드 선정 -> 경쟁사 분석 -> 전략적 생성 -> 발행
 */
export async function runAutoPilot(options: AutoPilotOptions) {
  const { broadTopic, config, userDataPath, geminiClient, publishPlatforms, credentials, headless, onProgress } = options;
  const log = (msg: string) => onProgress?.(msg);

  try {
    // 1. 키워드 확장 (Scaling)
    log(`🧠 주제 '${broadTopic}' 분석 및 키워드 확장 중...`);
    const expander = new TopicExpanderService(geminiClient);
    const candidates = await expander.expandTopic(broadTopic);
    log(`✅ ${candidates.length}개의 후보 키워드 발굴 완료`);

    // 2. 황금 키워드 선정 (Selection)
    log(`⚖️ 후보 키워드 정밀 스코어링 시작...`);
    const scout = new KeywordScoutService(config);
    const analyzedCandidates = await Promise.all(
      candidates.map(async (c) => {
        const analysis = await scout.analyzeKeyword(c.keyword);
        return { ...c, ...analysis };
      })
    );

    // 점수가 가장 높은 키워드 선정
    const bestTarget = analyzedCandidates.sort((a, b) => b.score - a.score)[0];
    log(`🎯 최종 황금 키워드 선정: [${bestTarget.keyword}] (점수: ${bestTarget.score})`);
    log(`💡 선정 이유: ${bestTarget.reason}`);

    // 3. 경쟁사 구조 분석 (Strategy)
    log(`📊 상위 노출 블로그 구조 분석 중...`);
    const analyzer = new CompetitorAnalyzerService();
    const strategy = await analyzer.analyzeStructure(bestTarget);
    log(`📝 전략 수립: 목표 분량 ${strategy.estimatedLength}자, 표 포함 여부: ${strategy.hasTable}`);

    // 4. 전략 기반 콘텐츠 생성 (Strategic Generation)
    log(`🤖 맞춤형 콘텐츠 생성 중...`);
    
    const task: BatchTask = {
      topic: bestTarget.keyword,
      persona: "informative",
      tone: "professional",
      status: "진행",
      category: "IT/테크",
      keywords: [bestTarget.keyword, ...bestTarget.topTitles.slice(0, 3)],
    };

    // 프롬프트에 경쟁사 분석 전략 주입 (task에 추가 정보를 담아 전달)
    const customInstruction = `
      [전략적 지시사항]
      1. 상위 노출을 위해 다음 구조를 반드시 따르세요: ${strategy.suggestedOutline.join(" -> ")}
      2. 분량은 약 ${strategy.estimatedLength}자 정도로 상세하게 작성하세요.
      ${strategy.hasTable ? "3. 비교 분석을 위한 '표(Table)'를 반드시 포함하세요." : ""}
      4. 핵심 키워드 [${strategy.keyPhrases.join(", ")}]를 자연스럽게 녹여내세요.
    `;

    // generatePost 호출 시 이 지시사항이 반영되도록 task.topic을 보강하거나 
    // 내부적으로 generatePost가 이 정보를 활용하도록 수정 필요 (현재는 topic만 전달)
    const publication = await generatePost({
      client: geminiClient,
      task: {
        ...task,
        topic: `${task.topic}\n\n${customInstruction}` // 토픽 뒤에 지시사항 추가
      },
      projectRoot: userDataPath,
      onProgress: (msg) => log(`[AI] ${msg}`),
    });

    if (!publication) throw new Error("콘텐츠 생성 실패");

    // 5. 블로그 발행 (Publishing)
    const htmlContent = await markdownToHtml(publication.content);
    
    for (const platform of publishPlatforms) {
      log(`🚀 ${platform.toUpperCase()} 발행 시작...`);
      
      let publisher: IBlogPublisher | null = null;
      let pubCreds: any = {};

      if (platform === "naver" && credentials.naver) {
        publisher = new NaverPublisher(userDataPath);
        pubCreds = { blogId: credentials.naver.id, password: credentials.naver.pw, headless };
      } else if (platform === "tistory" && credentials.tistory) {
        publisher = new TistoryPublisher(userDataPath);
        pubCreds = { blogId: credentials.tistory.id, password: credentials.tistory.pw, headless };
      }

      if (publisher) {
        await publisher.publish(pubCreds, {
          ...publication,
          content: htmlContent,
          tags: publication.tags || bestTarget.keyword.split(" "),
        });
        log(`✅ ${platform.toUpperCase()} 발행 완료!`);
      }
    }

    return { success: true, analysis: bestTarget, publication };

  } catch (error: any) {
    log(`❌ 에러 발생: ${error.message}`);
    return { success: false, error: error.message };
  }
}