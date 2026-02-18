import React, { useState, useEffect } from "react";

interface AutoPilotControlProps {
  isSearching: boolean;
  isPublishing: boolean;
  candidates: any[];
  recommendations: Record<string, any[]>;
  isFetchingRecs: boolean;
  onFetch: (topic: string) => void;
  onStop: () => void;
  onStart: (analysis: any, options: any) => void;
  onFetchRecs: (category: string) => void;
}

export const AutoPilotControl: React.FC<AutoPilotControlProps> = ({
  isSearching,
  isPublishing,
  candidates,
  recommendations,
  isFetchingRecs,
  onFetch,
  onStop,
  onStart,
  onFetchRecs,
}) => {
  const [topic, setTopic] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("tech");
  
  const categories = [
    { id: "tech", label: "💻 IT/테크" },
    { id: "economy", label: "📈 경제" },
    { id: "entertainment", label: "🎬 연예" },
    { id: "life", label: "🏠 생활" },
    { id: "travel", label: "✈️ 여행" },
  ];

  // 카테고리 변경 시 추천 토픽 가져오기
  useEffect(() => {
    if (!recommendations[activeCategory]) {
      onFetchRecs(activeCategory);
    }
  }, [activeCategory]);

  // 발행 설정 모달 상태
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [categoryInput, setCategoryInput] = useState("");
  const [persona, setPersona] = useState<string>("informative");
  const [tone, setTone] = useState<string>("professional");
  const [useImage, setUseImage] = useState(true);

  const isAnalyzing = isSearching && candidates.length === 0;
  const isProcessing = isSearching || isPublishing;

  // 로딩 메시지 순환 효과
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing || isFetchingRecs) {
      const messages = isFetchingRecs 
        ? [
            "📡 최신 트렌드 데이터를 수집하고 있습니다...",
            "🤖 AI가 오늘 발행하기 좋은 토픽을 선별 중입니다...",
            "💡 할당량 초과 시 자동으로 다음 키를 시도합니다. 잠시만 기다려 주세요...",
            "📊 카테고리별 전략적 주제를 구성하고 있습니다..."
          ]
        : [
            "🤖 AI가 주제와 관련된 황금 키워드를 발굴하고 있습니다...",
            "🔍 각 키워드의 실시간 검색량을 분석 중입니다...",
            "⚖️ 경쟁률을 계산하여 승산 있는 키워드를 선별하고 있습니다...",
            "📊 데이터를 정리하고 있습니다. 잠시만 기다려 주세요..."
          ];
      let i = 0;
      setStatusMessage(messages[0]);
      interval = setInterval(() => {
        i = (i + 1) % messages.length;
        setStatusMessage(messages[i]);
      }, 3000);
    } else {
      setStatusMessage("");
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleFetch = () => {
    if (!topic.trim()) {
      alert("주제를 입력해주세요.");
      return;
    }
    onFetch(topic.trim());
  };

  const handleStop = () => {
    onStop();
    setStatusMessage("🛑 중단 요청 중...");
  };

  const openPublishModal = (candidate: any) => {
    setSelectedCandidate(candidate);
    setCategoryInput("일상정보"); // 기본값 설정
  };

  const confirmPublish = () => {
    if (!selectedCandidate) return;
    if (!categoryInput.trim()) {
      alert("블로그 게시판 이름을 입력해 주세요.");
      return;
    }
    // v4.0: 페르소나, 톤, 이미지 설정 포함하여 시작
    onStart(selectedCandidate, {
      category: categoryInput.trim(),
      persona,
      tone,
      useImage
    });
    setSelectedCandidate(null);
  };

  return (
    <div
      className="autopilot-control"
      style={{
        backgroundColor: "#f5f7ff",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        border: "2px solid #6366f1",
        display: "flex",
        flexDirection: "column",
        gap: "15px",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* 로딩 바 애니메이션 */}
      {isAnalyzing && (
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "4px",
          background: "linear-gradient(90deg, #6366f1 0%, #a5b4fc 50%, #6366f1 100%)",
          backgroundSize: "200% 100%", animation: "loading-bar 1.5s infinite linear"
        }} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.2rem" }}>🚀</span>
        <h2 style={{ fontSize: "1.1rem", margin: 0, color: "#4338ca" }}>
          오늘의 추천 토픽 (실시간 트렌드 분석)
        </h2>
      </div>

      {/* 카테고리 탭 */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: "none",
              backgroundColor: activeCategory === cat.id ? "#6366f1" : "#eef2ff",
              color: activeCategory === cat.id ? "white" : "#4338ca",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "0.2s"
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 추천 토픽 카드 리스트 */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
        gap: "12px",
        maxHeight: "350px",
        overflowY: "auto",
        padding: "4px"
      }}>
        {isFetchingRecs ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "#6366f1" }}>
            <span className="spinner" style={{ display: "inline-block", width: "20px", height: "20px", border: "3px solid #eef2ff", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s infinite linear" }} />
            <div style={{ marginTop: "10px", fontWeight: "600" }}>최신 트렌드 수집 및 분석 중...</div>
          </div>
        ) : recommendations[activeCategory]?.map((rec, idx) => (
          <div 
            key={idx}
            style={{
              backgroundColor: "white",
              padding: "15px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "10px",
              transition: "0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.borderColor = "#6366f1"}
            onMouseOut={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <strong style={{ fontSize: "0.95rem", color: "#1e293b", lineHeight: "1.4" }}>{rec.keyword}</strong>
                <span style={{ fontSize: "0.75rem", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#fef3c7", color: "#92400e", fontWeight: "700" }}>
                  🔥 {rec.hotness}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", color: "#64748b", margin: "8px 0 0 0", lineHeight: "1.5" }}>{rec.reason}</p>
            </div>
            <button
              onClick={() => openPublishModal({ keyword: rec.keyword, reason: rec.reason })}
              disabled={isProcessing}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#6366f1",
                color: "white",
                fontSize: "0.8rem",
                fontWeight: "bold",
                cursor: isProcessing ? "not-allowed" : "pointer"
              }}
            >
              이 주제로 발행하기
            </button>
          </div>
        ))}
      </div>

      <div style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "10px 0" }} />

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.2rem" }}>🔍</span>
        <h2 style={{ fontSize: "1rem", margin: 0, color: "#4338ca" }}>
          직접 주제 검색 (Auto-Pilot v2.0)
        </h2>
      </div>

      {/* 1단계: 주제 입력 및 후보 발굴 */}
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="포스팅하고 싶은 큰 주제를 입력하세요 (예: 보험, 구독서비스, 여행)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isProcessing}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "Enter") handleFetch();
          }}
          style={{
            flex: 1, padding: "12px", borderRadius: "8px",
            border: "1px solid #c7d2fe", fontSize: "1rem", outline: "none",
          }}
        />
        <button
          onClick={handleFetch}
          disabled={isProcessing || !topic.trim()}
          style={{
            backgroundColor: (isProcessing || !topic.trim()) ? "#94a3b8" : "#6366f1",
            color: "white", border: "none", borderRadius: "8px", padding: "0 25px",
            fontWeight: "bold", cursor: (isProcessing || !topic.trim()) ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", gap: "8px",
            transition: "all 0.2s"
          }}
        >
          {isSearching && (
            <span className="spinner" style={{
              width: "14px", height: "14px", border: "2px solid white",
              borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s infinite linear"
            }} />
          )}
          {isSearching ? "분석 중..." : "황금 키워드 발굴"}
        </button>

        {isProcessing && (
          <button
            onClick={handleStop}
            style={{
              backgroundColor: "#ef4444",
              color: "white", border: "none", borderRadius: "8px", padding: "0 15px",
              fontWeight: "bold", cursor: "pointer", fontSize: "0.85rem"
            }}
          >
            중단
          </button>
        )}
      </div>

      {/* 상태 메시지 */}
      {(statusMessage || isFetchingRecs) && (
        <div style={{ 
          fontSize: "0.85rem", color: "#4f46e5", backgroundColor: "#eef2ff", 
          padding: "10px", borderRadius: "6px", textAlign: "center", fontWeight: "500",
          animation: "pulse 2s infinite"
        }}>
          {statusMessage || "🚀 트렌드 분석 중..."}
        </div>
      )}

      {/* 2단계: 후보 리스트 표시 및 선택 */}
      {candidates.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h3 style={{ fontSize: "0.9rem", color: "#4338ca", marginBottom: "10px" }}>
            🎯 발굴된 황금 키워드 후보 (상위 점수순)
          </h3>
          <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", backgroundColor: "white" }}>
              <thead style={{ backgroundColor: "#f8fafc", position: "sticky", top: 0 }}>
                <tr>
                  <th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>키워드</th>
                  <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>검색량</th>
                  <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>점수</th>
                  <th style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid #e2e8f0" }}>실행</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: "bold" }}>{c.keyword}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{c.reason}</div>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {c.totalSearchCnt?.toLocaleString() || 0}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <span style={{ 
                        padding: "2px 8px", borderRadius: "12px", 
                        backgroundColor: c.score >= 60 ? "#dcfce7" : "#fee2e2",
                        color: c.score >= 60 ? "#166534" : "#991b1b", fontWeight: "bold"
                      }}>
                        {c.score}점
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <button
                        onClick={() => openPublishModal(c)}
                        disabled={isProcessing}
                        style={{
                          padding: "5px 12px", borderRadius: "6px",
                          backgroundColor: "#4f46e5", color: "white", border: "none",
                          fontSize: "0.75rem", cursor: isProcessing ? "not-allowed" : "pointer"
                        }}
                      >
                        {isProcessing ? "진행 중" : "발행하기"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 발행 설정 모달 */}
      {selectedCandidate && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", padding: "25px", borderRadius: "12px",
            width: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", gap: "15px"
          }}>
            <h3 style={{ margin: 0, color: "#333" }}>🚀 발행 설정</h3>
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "5px" }}>
                선택된 키워드
              </label>
              <div style={{ padding: "10px", backgroundColor: "#f1f5f9", borderRadius: "6px", fontWeight: "bold" }}>
                {selectedCandidate.keyword}
              </div>
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "5px" }}>
                업로드할 블로그 게시판 이름 (필수)
              </label>
              <input 
                type="text" 
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                placeholder="예: 일상정보, IT리뷰, 맛집탐방"
                style={{
                  width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1",
                  fontSize: "0.95rem"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "5px" }}>페르소나</label>
                <select 
                  value={persona} 
                  onChange={(e) => setPersona(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="informative">분석가 (정보)</option>
                  <option value="experiential">리뷰어 (후기)</option>
                  <option value="reporter">리포터 (뉴스)</option>
                  <option value="entertainment">엔터형 (팬)</option>
                  <option value="travel">여행 가이드</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#666", marginBottom: "5px" }}>톤 (말투)</label>
                <select 
                  value={tone} 
                  onChange={(e) => setTone(e.target.value)}
                  style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="professional">하십시오체</option>
                  <option value="incisive">해요체</option>
                  <option value="serious">평어체</option>
                  <option value="empathetic">공감형</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input 
                type="checkbox" 
                id="modal-use-image"
                checked={useImage} 
                onChange={(e) => setUseImage(e.target.checked)}
              />
              <label htmlFor="modal-use-image" style={{ fontSize: "0.85rem", color: "#333", cursor: "pointer" }}>
                AI 자동 이미지 삽입
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
              <button 
                onClick={() => setSelectedCandidate(null)}
                style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "white", cursor: "pointer" }}
              >
                취소
              </button>
              <button 
                onClick={confirmPublish}
                style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", backgroundColor: "#4f46e5", color: "white", fontWeight: "bold", cursor: "pointer" }}
              >
                발행 시작
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loading-bar { from { background-position: 200% 0; } to { background-position: -200% 0; } }
        @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
      `}</style>
    </div>
  );
};
