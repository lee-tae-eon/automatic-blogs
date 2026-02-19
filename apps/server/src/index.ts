import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { 
  GeminiClient, 
  runAutoPilot, 
  generatePost, 
  markdownToHtml, 
  NaverPublisher,
  TopicRecommendationService 
} from "@blog-automation/core";

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
    naverPw: "Smi858619@@",
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
            label { font-size: 14px; color: #8e8e93; display: block; margin-bottom: 5px; font-weight: 500; }
            input, textarea, select {
                width: 100%; border: 1px solid #d1d1d6; border-radius: 12px; padding: 14px;
                box-sizing: border-box; font-size: 16px; outline: none; margin-bottom: 15px; background: white;
            }
            button {
                width: 100%; background: var(--ios-blue); color: white; border: none; border-radius: 12px;
                padding: 18px; font-size: 17px; font-weight: 600; cursor: pointer;
            }
            button:disabled { background: #aeaeae; opacity: 0.7; }
            #main-ui { display: none; }
            #login-ui { margin-top: 80px; text-align: center; }
            #status-box { background: #f8f8fa; border-radius: 12px; padding: 15px; font-size: 14px; color: #3a3a3c; min-height: 60px; text-align: center; display: flex; align-items: center; justify-content: center; }
            
            /* Tab Styles */
            .tabs { display: flex; background: #e3e3e8; border-radius: 12px; padding: 4px; margin-bottom: 20px; }
            .tab { flex: 1; text-align: center; padding: 10px; font-size: 15px; font-weight: 600; color: #8e8e93; cursor: pointer; border-radius: 10px; transition: 0.2s; }
            .tab.active { background: white; color: #1c1c1e; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .tab-content { display: none; }
            .tab-content.active { display: block; }

            /* Recommendation Cards */
            .rec-card { background: #f8f8fa; border-radius: 15px; padding: 15px; margin-bottom: 12px; border: 1px solid #e5e5ea; }
            .rec-title { font-weight: 700; font-size: 15px; margin-bottom: 5px; color: #1c1c1e; display: flex; justify-content: space-between; }
            .rec-reason { font-size: 13px; color: #8e8e93; line-height: 1.4; margin-bottom: 10px; }
            .badge { background: #fff3cd; color: #92400e; font-size: 11px; padding: 2px 6px; border-radius: 5px; font-weight: 800; }
            .btn-mini { padding: 8px 15px; font-size: 13px; border-radius: 8px; width: auto; margin-top: 5px; }
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
            <!-- 🌟 추천 토픽 영역 추가 -->
            <div class="card" style="padding: 20px 15px;">
                <h2 style="font-size: 18px; margin-bottom: 15px; text-align: left;">🌟 오늘의 추천 토픽</h2>
                <div style="display: flex; gap: 5px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 15px; -webkit-overflow-scrolling: touch;">
                    <button class="tab-mini" onclick="loadRecs('tech')" style="white-space: nowrap; padding: 6px 12px; font-size: 13px; border-radius: 15px; border: none; background: #eef2ff; color: #4338ca;">💻 테크</button>
                    <button class="tab-mini" onclick="loadRecs('economy')" style="white-space: nowrap; padding: 6px 12px; font-size: 13px; border-radius: 15px; border: none; background: #eef2ff; color: #4338ca;">📈 경제</button>
                    <button class="tab-mini" onclick="loadRecs('entertainment')" style="white-space: nowrap; padding: 6px 12px; font-size: 13px; border-radius: 15px; border: none; background: #eef2ff; color: #4338ca;">🎬 연예</button>
                    <button class="tab-mini" onclick="loadRecs('life')" style="white-space: nowrap; padding: 6px 12px; font-size: 13px; border-radius: 15px; border: none; background: #eef2ff; color: #4338ca;">🏠 생활</button>
                    <button class="tab-mini" onclick="loadRecs('travel')" style="white-space: nowrap; padding: 6px 12px; font-size: 13px; border-radius: 15px; border: none; background: #eef2ff; color: #4338ca;">✈️ 여행</button>
                </div>
                <div id="rec-list" style="max-height: 300px; overflow-y: auto;">
                    <p style="text-align:center; color:#8e8e93; font-size:13px; padding: 20px;">카테고리를 선택하여<br>추천 주제를 확인하세요.</p>
                </div>
            </div>

            <div class="card">
                <h2 id="welcome-msg" style="margin-bottom: 10px;">🚀 반갑습니다</h2>
                <div class="tabs">
                    <div class="tab active" onclick="switchTab('auto')">Auto-Pilot</div>
                    <div class="tab" onclick="switchTab('manual')">Manual</div>
                </div>

                <!-- Auto Tab -->
                <div id="tab-auto" class="tab-content active">
                    <label>블로그 주제</label>
                    <textarea id="topic-auto" placeholder="어떤 큰 주제로 블로그를 쓸까요? AI가 키워드를 확장하고 분석합니다."></textarea>
                </div>

                <!-- Manual Tab -->
                <div id="tab-manual" class="tab-content">
                    <label>구체적 주제 (키워드)</label>
                    <input type="text" id="topic-manual" placeholder="블로그 제목이나 구체적 키워드를 입력하세요.">
                    
                    <label>참고 키워드 (쉼표 구분)</label>
                    <input type="text" id="keywords-manual" placeholder="예: 아이폰16, 가성비폰, 추천">
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 0;">
                    <div style="flex: 1;">
                        <label>페르소나</label>
                        <select id="persona">
                            <option value="informative">정보형 (The Analyst)</option>
                            <option value="experiential">후기형 (The Reviewer)</option>
                            <option value="reporter">이슈형 (The Reporter)</option>
                            <option value="entertainment">엔터형 (The Fan)</option>
                            <option value="travel">여행 정보 (The Guide)</option>
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label>말투 (Tone)</label>
                        <select id="tone">
                            <option value="professional">분석가 (하십시오)</option>
                            <option value="incisive">리뷰어 (해요체)</option>
                            <option value="serious">리포터 (평어체)</option>
                            <option value="empathetic">공감형 (해요/네)</option>
                        </select>
                    </div>
                </div>

                <div style="margin-bottom: 0;">
                    <label>이미지 설정</label>
                    <select id="useImage">
                        <option value="true">AI 자동 이미지 (Pexels)</option>
                        <option value="false">이미지 사용 안 함</option>
                    </select>
                </div>

                <label>게시판 이름</label>
                <input type="text" id="blogBoardName" placeholder="예: 일상정보, IT/테크" value="일상정보">

                <button id="runBtn" onclick="run()">발행 시작</button>
                <button onclick="logout()" style="background:none; color:#8e8e93; font-size:13px; margin-top:15px; font-weight: normal;">로그아웃</button>
            </div>
            <div class="card" style="padding: 15px;">
                <div id="status-box">대기 중...</div>
            </div>
        </div>

        <script>
            let userSession = null;
            let currentMode = 'auto';

            window.onload = () => {
                const saved = localStorage.getItem('blog_session_v3');
                if (saved) {
                    userSession = JSON.parse(saved);
                    showMain();
                }
            };

            function switchTab(mode) {
                currentMode = mode;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                if (mode === 'auto') {
                    document.querySelector('.tab:nth-child(1)').classList.add('active');
                    document.getElementById('tab-auto').classList.add('active');
                } else {
                    document.querySelector('.tab:nth-child(2)').classList.add('active');
                    document.getElementById('tab-manual').classList.add('active');
                }
            }

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

            async function loadRecs(category) {
                const list = document.getElementById('rec-list');
                list.innerHTML = '<p style="text-align:center; padding:20px;"><span class="spinner"></span> 로딩 중...</p>';
                
                try {
                    const res = await fetch('/api/recommendations?category=' + category);
                    const data = await res.json();
                    if (data.success) {
                        list.innerHTML = data.data.map(item => 
                            '<div class="rec-card">' +
                                '<div class="rec-title">' + item.keyword + ' <span class="badge">🔥 ' + item.hotness + '</span></div>' +
                                '<div class="rec-reason">' + item.reason + '</div>' +
                                '<button class="btn-mini" onclick="selectRec(\'' + item.keyword.replace(/'/g, "\\'") + '\')">이 주제로 작성</button>' +
                            '</div>'
                        ).join('');
                    }
                } catch(e) {
                    list.innerHTML = '<p style="text-align:center; color:red; padding:20px;">로딩 실패</p>';
                }
            }

            function selectRec(keyword) {
                switchTab('auto');
                document.getElementById('topic-auto').value = keyword;
                window.scrollTo({ top: document.getElementById('tab-auto').offsetTop - 100, behavior: 'smooth' });
            }

            async function run() {
                const topic = currentMode === 'auto' 
                    ? document.getElementById('topic-auto').value 
                    : document.getElementById('topic-manual').value;
                const keywords = currentMode === 'manual' ? document.getElementById('keywords-manual').value : '';
                const blogBoardName = document.getElementById('blogBoardName').value;
                const persona = document.getElementById('persona').value;
                const tone = document.getElementById('tone').value;
                const useImage = document.getElementById('useImage').value === 'true';

                if (!topic) return alert('주제를 입력하세요.');
                if (!blogBoardName) return alert('게시판 이름을 입력하세요.');

                const btn = document.getElementById('runBtn');
                btn.disabled = true;

                try {
                    const res = await fetch('/api/publish', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            topic, 
                            mode: currentMode,
                            keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
                            blogBoardName, 
                            persona,
                            tone,
                            useImage,
                            pin: userSession.pin 
                        })
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

// 📈 추천 토픽 API
app.get("/api/recommendations", async (req: Request, res: Response) => {
  const { category } = req.query;
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ success: false, error: "API Key missing" });

  try {
    const client = new GeminiClient(apiKey, "gemini-2.5-flash");
    const service = new TopicRecommendationService(client);
    const data = await service.getRecommendationsByCategory(category as any);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
  const { topic, mode, keywords, blogBoardName, persona, tone, useImage, pin } = req.body;
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
  console.log(
    `[SERVER] ${user.name} started (${mode}): ${topic} (Board: ${blogBoardName}, Persona: ${persona}, Tone: ${tone}, Image: ${useImage})`,
  );

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

  const userDataPath = path.join(__dirname, "../../../");

  try {
    let result;
    if (mode === "auto") {
      result = await runAutoPilot({
        broadTopic: topic,
        blogBoardName,
        config,
        userDataPath,
        geminiClient: client,
        publishPlatforms: ["naver"],
        credentials: { naver: { id: user.naverId, pw: user.naverPw } },
        persona,
        tone,
        useImage,
        headless: true,
        onProgress: (msg: string) => {
          currentLog = msg;
          console.log(`[${user.name}] ${msg}`);
        },
      } as any);
    } else {
      // Manual Mode
      currentLog = "🤖 매뉴얼 모드 콘텐츠 생성 중...";
      
      const task: any = {
        topic,
        keywords,
        persona,
        tone,
        useImage,
        category: "정보/리뷰",
        status: "진행",
        mode: "manual"
      };

      const publication = await generatePost({
        client,
        task,
        projectRoot: userDataPath,
        onProgress: (msg: string) => {
          currentLog = `[AI] ${msg}`;
          console.log(`[${user.name}] ${msg}`);
        },
      });

      if (!publication) throw new Error("콘텐츠 생성 실패");

      currentLog = "🚀 네이버 발행 중...";
      const htmlContent = await markdownToHtml(publication.content);
      const publisher = new NaverPublisher(userDataPath, user.naverId);
      
      await publisher.publish(
        { blogId: user.naverId, password: user.naverPw, headless: true },
        {
          ...publication,
          content: htmlContent,
          category: blogBoardName,
          tags: publication.tags || (keywords.length > 0 ? keywords : topic.split(" ")),
        }
      );
      
      result = { success: true, publication };
    }

    res.json(
      result.success
        ? { success: true, title: result.publication?.title }
        : { success: false, error: result.error },
    );
  } catch (error: any) {
    res.json({ success: false, error: error.message });
  } finally {
    isProcessing = false;
    // 3초 후 대기 상태로 변경 (마지막 로그를 볼 수 있도록)
    setTimeout(() => {
      if (!isProcessing) currentLog = "대기 중...";
    }, 3000);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 보안 서버 시작: http://0.0.0.0:${PORT}`);
});
