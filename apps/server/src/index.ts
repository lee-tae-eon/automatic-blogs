import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { GeminiClient, runAutoPilot } from "@blog-automation/core";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

const app = express();
const PORT = 1216;

app.use(cors());
app.use(express.json());

// 🔐 승인된 사용자 및 개별 PIN 설정 (Whitelist)
// 아이폰에서 접속 시 이 PIN을 입력한 사람만 제어 화면이 보입니다.
const allowedUsers: Record<
  string,
  { pin: string; name: string; naverId: string; naverPw: string }
> = {
  ryan: {
    pin: "0612", // 라이언용 PIN
    name: "태언",
    naverId: "eongon",
    naverPw: process.env.USER1_PW || "Woo8328055@",
  },
  guest1: {
    pin: "1119", // 지인용 PIN
    name: "희경",
    naverId: "prettyhihihi",
    naverPw: "guest_pw",
  },
};

let currentLog = "대기 중...";
let isProcessing = false;

// 📱 아이폰용 통합 보안 UI
app.get("/", (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>라이언 블로그 Private</title>
        <style>
            :root { --ios-blue: #007aff; --ios-bg: #f2f2f7; }
            body { font-family: -apple-system, sans-serif; background: var(--ios-bg); margin: 0; padding: 20px; color: #1c1c1e; }
            .card { background: white; border-radius: 20px; padding: 25px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); margin-bottom: 20px; }
            h2 { margin: 0 0 20px 0; font-size: 22px; text-align: center; }
            input, textarea {
                width: 100%; border: 1px solid #d1d1d6; border-radius: 12px; padding: 14px;
                box-sizing: border-box; font-size: 16px; outline: none; margin-bottom: 15px;
            }
            button {
                width: 100%; background: var(--ios-blue); color: white; border: none; border-radius: 12px;
                padding: 18px; font-size: 17px; font-weight: 600; cursor: pointer;
            }
            button:disabled { background: #aeaeae; opacity: 0.7; }
            #main-ui { display: none; }
            #login-ui { margin-top: 80px; text-align: center; }
            #status-box { background: #f8f8fa; border-radius: 12px; padding: 15px; font-size: 14px; color: #3a3a3c; min-height: 60px; text-align: center; display: flex; align-items: center; justify-content: center; }
        </style>
    </head>
    <body>
        <div id="login-ui" class="card">
            <h2>🔐 Private Access</h2>
            <p style="color: #8e8e93; font-size: 14px; margin-bottom: 20px;">승인된 사용자만 접속 가능합니다.</p>
            <input type="password" id="pinInput" placeholder="PIN 번호 입력" inputmode="numeric">
            <button onclick="login()">인증하기</button>
        </div>

        <div id="main-ui">
            <div class="card">
                <h2 id="welcome-msg">🚀 오토파일럿</h2>
                <label>블로그 주제</label>
                <textarea id="topic" placeholder="어떤 주제로 블로그를 쓸까요?"></textarea>
                
                <label>게시판 이름 (네이버 블로그 카테고리)</label>
                <input type="text" id="blogBoardName" placeholder="예: 일상정보, IT/테크" value="">

                <p style="font-size: 12px; color: #ff3b30; margin: 5px 0 0 5px; font-weight: 500;">
                    * 정확한 게시판 이름을 입력해야 발행됩니다.
                </p>

                <button id="runBtn" onclick="run()">발행 시작</button>
                <button onclick="logout()" style="background:none; color:#8e8e93; font-size:13px; margin-top:15px; font-weight: normal;">로그아웃</button>
            </div>
            <div class="card">
                <div id="status-box">대기 중...</div>
            </div>
        </div>

        <script>
            let userSession = null;

            window.onload = () => {
                const saved = localStorage.getItem('blog_session_v3');
                if (saved) {
                    userSession = JSON.parse(saved);
                    showMain();
                }
            };

            async function login() {
                const pin = document.getElementById('pinInput').value;
                if (!pin) return alert('PIN을 입력하세요.');

                const res = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
                });
                const data = await res.json();
                if (data.success) {
                    userSession = { pin, name: data.name };
                    localStorage.setItem('blog_session_v3', JSON.stringify(userSession));
                    showMain();
                } else {
                    alert('❌ 잘못된 PIN 번호입니다.');
                }
            }

            function showMain() {
                document.getElementById('login-ui').style.display = 'none';
                document.getElementById('main-ui').style.display = 'block';
                document.getElementById('welcome-msg').innerText = '🚀 ' + userSession.name + '님 환영합니다';
                startLogStream();
            }

            function logout() {
                localStorage.removeItem('blog_session_v3');
                location.reload();
            }

            function startLogStream() {
                const es = new EventSource('/api/events');
                es.onmessage = (e) => {
                    document.getElementById('status-box').innerText = e.data;
                };
            }

            async function run() {
                const topic = document.getElementById('topic').value;
                const blogBoardName = document.getElementById('blogBoardName').value;
                if (!topic) return alert('주제를 입력하세요.');
                if (!blogBoardName) return alert('게시판 이름을 입력하세요.');

                const btn = document.getElementById('runBtn');
                btn.disabled = true;

                try {
                    const res = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ topic, blogBoardName, pin: userSession.pin })
                    });
                    const data = await res.json();
                    if (res.status === 401) {
                        alert('❌ 인증 세션 만료. 다시 로그인하세요.');
                        logout();
                    } else {
                        alert(data.success ? '✅ 발행 완료: ' + data.title : '❌ 실패: ' + data.error);
                    }
                } catch (e) {
                    alert('❌ 서버 통신 오류');
                } finally {
                    btn.disabled = false;
                }
            }
        </script>
    </body>
    </html>
  `);
});

// 🔑 인증 API
app.post("/api/auth", (req: Request, res: Response) => {
  const { pin } = req.body;
  const userKey = Object.keys(allowedUsers).find(
    (k) => allowedUsers[k].pin === pin,
  );
  if (userKey) {
    res.json({ success: true, name: allowedUsers[userKey].name });
  } else {
    res.status(401).json({ success: false });
  }
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
  const { topic, blogBoardName, pin } = req.body;
  const userKey = Object.keys(allowedUsers).find(
    (k) => allowedUsers[k].pin === pin,
  );
  const user = userKey ? allowedUsers[userKey] : null;

  if (!user)
    return res.status(401).json({ success: false, error: "Unauthorized" });
  if (isProcessing)
    return res
      .status(400)
      .json({ success: false, error: "이미 작업이 진행 중입니다." });

  isProcessing = true;
  console.log(`[SERVER] ${user.name} started: ${topic} (Board: ${blogBoardName})`);

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
      blogBoardName: blogBoardName || "일상정보",
      config,
      userDataPath: path.join(__dirname, "../../../"),
      geminiClient: client,
      publishPlatforms: ["naver"],
      credentials: { naver: { id: user.naverId, pw: user.naverPw } },
      headless: true,
      onProgress: (msg: string) => {
        currentLog = msg;
        console.log(`[${user.name}] ${msg}`);
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
  console.log(`🚀 보안 서버 시작: http://0.0.0.0:${PORT}`);
});
