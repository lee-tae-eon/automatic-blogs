import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { GeminiClient, runAutoPilot } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const app = express();
const PORT = 3403;

app.use(cors());
app.use(express.json());

// 👥 미리 설정된 유저 프로필 (아이폰에서 선택 가능)
const userProfiles: Record<string, { id: string; pw: string; name: string }> = {
  user1: {
    id: "eongon",
    pw: process.env.USER1_PW || "Woo8328055@",
    name: "라이언 (eongon)",
  },
  user2: {
    id: "another_user", // 여기에 두 번째 유저 정보를 넣으세요
    pw: process.env.USER2_PW || "password",
    name: "서브 (another_user)",
  },
};

let currentLog = "대기 중...";
let isProcessing = false;

// 📱 아이폰용 프로필 선택 UI (HTML)
app.get("/", (req: Request, res: Response) => {
  const options = Object.entries(userProfiles)
    .map(([key, user]) => `<option value="${key}">${user.name}</option>`)
    .join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>라이언 매니저 v2</title>
        <style>
            :root { --ios-blue: #007aff; --ios-bg: #f2f2f7; }
            body { font-family: -apple-system, sans-serif; background: var(--ios-bg); margin: 0; padding: 20px; }
            .card { background: white; border-radius: 20px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); margin-bottom: 20px; }
            h2 { margin: 0 0 20px 0; font-size: 24px; }
            label { display: block; font-size: 13px; color: #8e8e93; margin: 15px 0 5px 5px; }
            select, textarea {
                width: 100%; border: 1px solid #d1d1d6; border-radius: 12px; padding: 14px;
                box-sizing: border-box; font-size: 16px; outline: none; background: white;
            }
            button {
                width: 100%; background: var(--ios-blue); color: white; border: none; border-radius: 12px;
                padding: 18px; font-size: 17px; font-weight: 600; cursor: pointer; margin-top: 20px;
            }
            button:disabled { background: #aeaeae; }
            #status-card { min-height: 80px; text-align: center; }
            #log-text { font-size: 15px; color: #3a3a3c; white-space: pre-wrap; line-height: 1.4; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>🚀 오토파일럿</h2>

            <label>사용자 선택 (세션 기억됨)</label>
            <select id="userSelect">${options}</select>

            <label>블로그 주제</label>
            <textarea id="topic" placeholder="어떤 글을 쓸까요?"></textarea>

            <button id="runBtn" onclick="run()">발행 시작</button>
        </div>

        <div class="card" id="status-card">
            <div id="log-text">대기 중...</div>
        </div>

        <script>
            const logText = document.getElementById('log-text');
            const runBtn = document.getElementById('runBtn');

            const eventSource = new EventSource('/api/events');
            eventSource.onmessage = (e) => {
                logText.innerText = e.data;
            };

            async function run() {
                const userId = document.getElementById('userSelect').value;
                const topic = document.getElementById('topic').value;

                if (!topic) return alert('주제를 입력해주세요!');

                runBtn.disabled = true;
                try {
                    const res = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId, topic })
                    });
                    const data = await res.json();
                    alert(data.success ? '✅ 완료: ' + data.title : '❌ 실패: ' + data.error);
                } catch (e) {
                    alert('❌ 서버 연결 실패');
                } finally {
                    runBtn.disabled = false;
                }
            }
        </script>
    </body>
    </html>
  `);
});

// 📢 실시간 로그 (SSE)
app.get("/api/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = () => res.write(`data: ${currentLog}\n\n`);
  const interval = setInterval(send, 1000);
  req.on("close", () => clearInterval(interval));
});

// ⚙️ 실행 API
app.post("/api/publish", async (req: Request, res: Response) => {
  const { userId, topic } = req.body;
  const user = userProfiles[userId];

  if (!user)
    return res
      .status(400)
      .json({ success: false, error: "유효하지 않은 유저입니다." });
  if (isProcessing)
    return res.status(400).json({ success: false, error: "작업 진행 중..." });

  isProcessing = true;
  console.log(`[SERVER] Task Start: ${topic} for ${user.name}`);

  const config = {
    searchClientId: process.env.VITE_NAVER_SEARCH_API_CLIENT || "",
    searchClientSecret: process.env.VITE_NAVER_SEARCH_API_KEY || "",
    adLicense: process.env.VITE_NAVER_SEARCH_AD_API_LICENSE || "",
    adSecret: process.env.VITE_NAVER_SEARCH_AD_API_KEY || "",
    adCustomerId: process.env.VITE_NAVER_SEARCH_AD_API_CUSTOMER_ID || "",
  };

  const client = new GeminiClient(
    process.env.VITE_GEMINI_API_KEY || "",
    "gemini-2.5-flash",
  );

  try {
    const result = await runAutoPilot({
      broadTopic: topic,
      blogBoardName: "일상정보",
      config,
      userDataPath: path.join(__dirname, "../../../"),
      geminiClient: client,
      publishPlatforms: ["naver"],
      credentials: { naver: { id: user.id, pw: user.pw } },
      headless: true,
      onProgress: (msg: string) => {
        currentLog = msg;
        console.log(`[PROG] ${msg}`);
      },
    } as any);

    res.json(
      result.success
        ? { success: true, title: result.publication?.title }
        : { success: false, error: result.error },
    );
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  } finally {
    isProcessing = false;
    currentLog = "대기 중...";
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 시작: http://0.0.0.0:${PORT}`);
});
