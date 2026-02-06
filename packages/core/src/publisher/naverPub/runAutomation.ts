import { app } from "electron";
import path from "path";
import fs from "fs";

export async function runAutomation() {
  // 1. [경로 설정] 안전한 사용자 데이터 폴더 안에 'session' 폴더를 따로 만듭니다.
  const USER_DATA_DIR = path.join(
    app.getPath("userData"),
    "automation-session",
  );

  // 폴더가 없으면 에러 날 수 있으니 생성해 줍니다.
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  // 2. [Playwright 로딩] (Lazy Import)
  // 환경변수 설정은 위에서 이미 했다고 가정 (process.env.PLAYWRIGHT_BROWSERS_PATH = ...)
  const { chromium } = await import("playwright");

  console.log(`📂 브라우저 데이터 저장 경로: ${USER_DATA_DIR}`);

  // 3. [브라우저 실행] launchPersistentContext 사용!
  // 첫 번째 인자로 '저장할 폴더 경로'를 줍니다.
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    // 필요하다면 executablePath 등의 옵션 추가
    args: ["--no-sandbox", "--disable-setuid-sandbox"], // 일렉트론 환경 안정성 확보
    viewport: { width: 1280, height: 720 },
  });

  // ⚠️ 주의: persistentContext는 그 자체로 '페이지'를 가질 수 있습니다.
  // context.newPage()를 쓰면 탭이 2개가 될 수 있으니,
  // 보통은 pages()[0]을 쓰거나 새로 하나만 엽니다.

  const page =
    context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  // --- 자동화 로직 시작 ---
  await page.goto("https://kauth.kakao.com/..."); // 예시

  // 로그인 체크 로직
  // 예: "로그인" 버튼이 보이면 로그인을 시도하고, 아니면(이미 로그인됨) 패스
  if (await page.isVisible('input[name="loginId"]')) {
    console.log("🔑 로그인이 필요합니다. 자동 로그인 진행...");
    // ... 아이디/비번 입력 로직 ...
  } else {
    console.log("✅ 이미 로그인되어 있습니다! (세션 유지 성공)");
  }

  // ...
}
