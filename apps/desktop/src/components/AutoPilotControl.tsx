import React, { useState, useEffect } from "react";

interface AutoPilotControlProps {
  isSearching: boolean;
  candidates: any[];
  recommendations: Record<string, any[]>;
  isFetchingRecs: boolean;
  onFetch: (topic: string) => void;
  onStop: () => void;
  onAddTask: (task: any) => void;
  onFetchRecs: (category: string) => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AutoPilotControl: React.FC<AutoPilotControlProps> = ({
  isSearching,
  candidates,
  recommendations,
  isFetchingRecs,
  onFetch,
  onStop,
  onAddTask,
  onFetchRecs,
  credentials,
  onChange,
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
    { id: "health", label: "🏥 건강" },
  ];

  const currentRecs = recommendations[activeCategory] || [];
  const hasRecs = currentRecs.length > 0;

  // 카테고리 변경 시 검색 유도 (자동 검색 제거)
  const handleFetchRecs = () => {
    onFetchRecs(activeCategory);
  };

  // 발행 설정 모달 상태
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [persona, setPersona] = useState<string>("informative");
  const [topicCount, setTopicCount] = useState<number>(10);
  const [tone, setTone] = useState<string>("empathetic");
  const [useImage, setUseImage] = useState<boolean>(true);
  const [useNotebookLM, setUseNotebookLM] = useState(false); // 추가
  const [notebookMode, setNotebookMode] = useState<"manual" | "auto">("auto"); // 추가

  const isAnalyzing = isSearching && candidates.length === 0;
  const isProcessing = isSearching;

  // 로딩 메시지 순환 효과
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAnalyzing || isFetchingRecs) {
      const messages = isFetchingRecs
        ? [
            "📡 최신 트렌드 데이터를 수집하고 있습니다...",
            "🤖 AI가 오늘 발행하기 좋은 토픽을 선별 중입니다...",
            "💡 할당량 초과 시 자동으로 다음 키를 시도합니다. 잠시만 기다려 주세요...",
            "📊 카테고리별 전략적 주제를 구성하고 있습니다...",
          ]
        : [
            "🤖 AI가 주제와 관련된 황금 키워드를 발굴하고 있습니다...",
            "🔍 각 키워드의 실시간 검색량을 분석 중입니다...",
            "⚖️ 경쟁률을 계산하여 승산 있는 키워드를 선별하고 있습니다...",
            "📊 데이터를 정리하고 있습니다. 잠시만 기다려 주세요...",
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

  const openPublishModal = (candidate: any, defaultCategory?: string) => {
    setSelectedCandidate(candidate);
  };

  const confirmPublish = () => {
    if (!selectedCandidate) return;

    onAddTask({
      topic: selectedCandidate.keyword,
      keywords: [], // Need to set empty tags
      category: "동적 카테고리 (계정별)",
      persona,
      tone,
      useImage,
      useNotebookLM,
      notebookMode,
      status: "대기",
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
        overflow: "hidden",
      }}
    >
      {/* 로딩 바 애니메이션 */}
      {isAnalyzing && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "4px",
            background:
              "linear-gradient(90deg, #6366f1 0%, #a5b4fc 50%, #6366f1 100%)",
            backgroundSize: "200% 100%",
            animation: "loading-bar 1.5s infinite linear",
          }}
        />
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
              backgroundColor:
                activeCategory === cat.id ? "#6366f1" : "#eef2ff",
              color: activeCategory === cat.id ? "white" : "#4338ca",
              fontWeight: "600",
              cursor: "pointer",
              fontSize: "0.85rem",
              transition: "0.2s",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 추천 토픽 카드 리스트 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasRecs
            ? "repeat(auto-fill, minmax(280px, 1fr))"
            : "1fr",
          gap: "12px",
          minHeight: "150px",
          maxHeight: "350px",
          overflowY: "auto",
          padding: "4px",
        }}
      >
        {isFetchingRecs ? (
          <div
            style={{ textAlign: "center", padding: "40px", color: "#6366f1" }}
          >
            <span
              className="spinner"
              style={{
                display: "inline-block",
                width: "20px",
                height: "20px",
                border: "3px solid #eef2ff",
                borderTopColor: "#6366f1",
                borderRadius: "50%",
                animation: "spin 0.8s infinite linear",
              }}
            />
            <div style={{ marginTop: "10px", fontWeight: "600" }}>
              최신 트렌드 분석 중...
            </div>
          </div>
        ) : !hasRecs ? (
          <div
            style={{
              textAlign: "center",
              padding: "30px",
              border: "2px dashed #c7d2fe",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <p style={{ fontSize: "0.9rem", color: "#4338ca", margin: 0 }}>
              해당 카테고리의 오늘의 추천 토픽이 아직 없습니다.
            </p>
            <button
              onClick={handleFetchRecs}
              style={{
                padding: "10px 24px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#6366f1",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow: "0 4px 6px rgba(99, 102, 241, 0.2)",
              }}
            >
              ⚡ 추천 토픽 가져오기
            </button>
          </div>
        ) : (
          currentRecs.map((rec, idx) => (
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
                transition: "0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.borderColor = "#6366f1")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.borderColor = "#e2e8f0")
              }
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "0.95rem",
                      color: "#1e293b",
                      lineHeight: "1.4",
                    }}
                  >
                    {rec.keyword}
                  </strong>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      backgroundColor: "#fef3c7",
                      color: "#92400e",
                      fontWeight: "700",
                    }}
                  >
                    🔥 {rec.hotness}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    margin: "8px 0 0 0",
                    lineHeight: "1.5",
                  }}
                >
                  {rec.reason}
                </p>
              </div>
              <button
                onClick={() =>
                  openPublishModal(
                    { keyword: rec.keyword, reason: rec.reason },
                    rec.category,
                  )
                }
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
                  cursor: isProcessing ? "not-allowed" : "pointer",
                }}
              >
                이 주제로 대기열에 추가하기
              </button>
            </div>
          ))
        )}
      </div>

      <div
        style={{ height: "1px", backgroundColor: "#e2e8f0", margin: "10px 0" }}
      />

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
            flex: 1,
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #c7d2fe",
            fontSize: "1rem",
            outline: "none",
          }}
        />
        <button
          onClick={handleFetch}
          disabled={isProcessing || !topic.trim()}
          style={{
            backgroundColor:
              isProcessing || !topic.trim() ? "#94a3b8" : "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0 25px",
            fontWeight: "bold",
            cursor: isProcessing || !topic.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s",
          }}
        >
          {isSearching && (
            <span
              className="spinner"
              style={{
                width: "14px",
                height: "14px",
                border: "2px solid white",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 0.8s infinite linear",
              }}
            />
          )}
          {isSearching ? "분석 중..." : "황금 키워드 발굴"}
        </button>

        {isProcessing && (
          <button
            onClick={handleStop}
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "0 15px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            중단
          </button>
        )}
      </div>

      {/* 상태 메시지 */}
      {(statusMessage || isFetchingRecs) && (
        <div
          style={{
            fontSize: "0.85rem",
            color: "#4f46e5",
            backgroundColor: "#eef2ff",
            padding: "10px",
            borderRadius: "6px",
            textAlign: "center",
            fontWeight: "500",
            animation: "pulse 2s infinite",
          }}
        >
          {statusMessage || "🚀 트렌드 분석 중..."}
        </div>
      )}

      {/* 2단계: 후보 리스트 표시 및 선택 */}
      {candidates.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          <h3
            style={{
              fontSize: "0.9rem",
              color: "#4338ca",
              marginBottom: "10px",
            }}
          >
            🎯 발굴된 황금 키워드 후보 (상위 점수순)
          </h3>
          <div
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.85rem",
                backgroundColor: "white",
              }}
            >
              <thead
                style={{
                  backgroundColor: "#f8fafc",
                  position: "sticky",
                  top: 0,
                }}
              >
                <tr>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "left",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    키워드
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    검색량
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    점수
                  </th>
                  <th
                    style={{
                      padding: "10px",
                      textAlign: "center",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    실행
                  </th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px" }}>
                      <div style={{ fontWeight: "bold" }}>{c.keyword}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        {c.reason}
                      </div>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      {c.totalSearchCnt?.toLocaleString() || 0}
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor:
                            c.score >= 60 ? "#dcfce7" : "#fee2e2",
                          color: c.score >= 60 ? "#166534" : "#991b1b",
                          fontWeight: "bold",
                        }}
                      >
                        {c.score}점
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <button
                        onClick={() => openPublishModal(c)}
                        disabled={isProcessing}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#4f46e5",
                          color: "white",
                          border: "none",
                          fontSize: "0.75rem",
                          cursor: isProcessing ? "not-allowed" : "pointer",
                        }}
                      >
                        {isProcessing ? "진행 중" : "대기열 추가"}
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
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "25px",
              borderRadius: "12px",
              width: "400px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "15px",
            }}
          >
            <h3 style={{ margin: 0, color: "#333" }}>🚀 대기열 추가 설정</h3>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "#666",
                  marginBottom: "5px",
                }}
              >
                선택된 키워드
              </label>
              <div
                style={{
                  padding: "10px",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "6px",
                  fontWeight: "bold",
                }}
              >
                {selectedCandidate.keyword}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  color: "#666",
                  marginBottom: "5px",
                }}
              >
                업로드할 블로그 게시판 이름 (선택된 네이버 계정)
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                }}
              >
                {credentials.enableNaver && credentials.naverId && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        width: "60px",
                        color: "#03c75a",
                      }}
                    >
                      Naver 1
                    </span>
                    <input
                      type="text"
                      name="naverCategory"
                      value={credentials.naverCategory}
                      onChange={onChange}
                      placeholder="예: 일상정보 (필수)"
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                )}
                {credentials.enableNaver2 && credentials.naverId2 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: "bold",
                        width: "60px",
                        color: "#03c75a",
                      }}
                    >
                      Naver 2
                    </span>
                    <input
                      type="text"
                      name="naverCategory2"
                      value={credentials.naverCategory2}
                      onChange={onChange}
                      placeholder="예: IT리뷰 (필수)"
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #cbd5e1",
                        fontSize: "0.85rem",
                      }}
                    />
                  </div>
                )}
                {(!credentials.enableNaver || !credentials.naverId) &&
                  (!credentials.enableNaver2 || !credentials.naverId2) && (
                    <span style={{ fontSize: "0.85rem", color: "#ef4444" }}>
                      게시판을 입력할 활성화된 네이버 계정이 없습니다. (설정을
                      확인해주세요)
                    </span>
                  )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: "#666",
                    marginBottom: "5px",
                  }}
                >
                  페르소나
                </label>
                <select
                  value={persona}
                  onChange={(e) => setPersona(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <option value="informative">분석가 (정보)</option>
                  <option value="experiential">리뷰어 (후기)</option>
                  <option value="reporter">리포터 (뉴스)</option>
                  <option value="entertainment">엔터형 (팬)</option>
                  <option value="travel">여행 가이드</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: "#666",
                    marginBottom: "5px",
                  }}
                >
                  톤 (말투)
                </label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <option value="professional">하십시오체</option>
                  <option value="incisive">해요체</option>
                  <option value="serious">평어체</option>
                  <option value="empathetic">공감형</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "12px",
                backgroundColor: "#f8faff",
                borderRadius: "10px",
                border: "1px solid #e1e8ff",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  color: "#4338ca",
                  fontWeight: "bold",
                }}
              >
                <input
                  type="checkbox"
                  checked={useNotebookLM}
                  onChange={(e) => setUseNotebookLM(e.target.checked)}
                />
                NotebookLM 전략적 고도화
              </label>

              {useNotebookLM && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    marginLeft: "24px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={notebookMode === "auto"}
                      onChange={() => setNotebookMode("auto")}
                    />
                    AI 자동 검수
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      checked={notebookMode === "manual"}
                      onChange={() => setNotebookMode("manual")}
                    />
                    사용자 직접 검수
                  </label>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "5px",
                }}
              >
                <input
                  type="checkbox"
                  id="modal-use-image"
                  checked={useImage}
                  onChange={(e) => setUseImage(e.target.checked)}
                />
                <label
                  htmlFor="modal-use-image"
                  style={{
                    fontSize: "0.85rem",
                    color: "#333",
                    cursor: "pointer",
                  }}
                >
                  이미지 자동 삽입
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
              <button
                onClick={() => setSelectedCandidate(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "white",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={confirmPublish}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
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
