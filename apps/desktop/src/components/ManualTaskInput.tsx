import React, { useState } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

interface ManualTaskInputProps {
  onAddTask: (task: BatchTask) => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

interface TrendTopic {
  topic: string;
  summary: string;
  keywords: string[];
}

export const ManualTaskInput: React.FC<ManualTaskInputProps> = ({
  onAddTask,
  credentials,
  onChange,
}) => {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [persona, setPersona] = useState<Persona>("informative");
  const [tone, setTone] = useState<Tone>("professional");
  const [useImage, setUseImage] = useState(true); // v4.7: 이미지 사용 기본값 true
  const [useNotebookLM, setUseNotebookLM] = useState(false); // v5.0: NotebookLM 사용 여부
  const [notebookMode, setNotebookMode] = useState<"manual" | "auto">("auto"); // v5.0: 검수 모드

  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [trendQuery, setTrendQuery] = useState("");
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [trendType, setTrendType] = useState<"hollywood" | "korea">(
    "hollywood",
  );

  const fetchTrends = async () => {
    setIsFetchingTrends(true);
    try {
      const channel =
        trendType === "hollywood"
          ? "fetch-hollywood-trends"
          : "fetch-korea-trends";
      const result = await window.ipcRenderer.invoke(channel, trendQuery);
      if (result && result.success) {
        setTrends(result.data);
      } else {
        alert(
          "트렌드를 가져오지 못했습니다: " +
            (result?.error || "알 수 없는 오류"),
        );
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const selectTrend = (trend: TrendTopic) => {
    setTopic(trend.topic);
    setKeywords(trend.keywords.join(", "));

    if (trendType === "hollywood") {
      setPersona("reporter");
      setTone("professional");
    } else {
      setPersona("informative");
      setTone("professional");
    }
  };

  const clearTrends = () => {
    setTrends([]);
    setTrendQuery("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert("주제를 입력해주세요.");
      return;
    }

    const newTask: BatchTask = {
      topic: topic.trim(),
      keywords: keywords ? keywords.split(",").map((k) => k.trim()) : [],
      category: "동적 카테고리 (계정별)",
      persona,
      tone,
      useImage,
      useNotebookLM, // 추가
      notebookMode, // 추가
      status: "대기",
    };

    onAddTask(newTask);

    // 폼 초기화
    setTopic("");
    setKeywords("");
  };

  return (
    <>
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
      </style>
      <div
        className="manual-input-container"
        style={{
          display: "grid",
          gridTemplateColumns: "350px 1fr",
          gap: "20px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e9ecef",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
        }}
      >
        {/* 왼쪽: 트렌드 탐색 */}
        <div
          className="trends-section"
          style={{ borderRight: "1px solid #f1f3f5", paddingRight: "20px" }}
        >
          {/* 탭 전환 */}
          <div
            style={{
              display: "flex",
              marginBottom: "15px",
              backgroundColor: "#f1f3f5",
              borderRadius: "8px",
              padding: "4px",
            }}
          >
            <button
              onClick={() => {
                setTrendType("hollywood");
                setTrends([]);
              }}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: "0.8rem",
                border: "none",
                borderRadius: "6px",
                backgroundColor:
                  trendType === "hollywood" ? "#fff" : "transparent",
                color: trendType === "hollywood" ? "#ff4757" : "#868e96",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow:
                  trendType === "hollywood"
                    ? "0 2px 4px rgba(0,0,0,0.05)"
                    : "none",
              }}
            >
              🎬 헐리우드
            </button>
            <button
              onClick={() => {
                setTrendType("korea");
                setTrends([]);
              }}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: "0.8rem",
                border: "none",
                borderRadius: "6px",
                backgroundColor: trendType === "korea" ? "#fff" : "transparent",
                color: trendType === "korea" ? "#03c75a" : "#868e96",
                fontWeight: "bold",
                cursor: "pointer",
                boxShadow:
                  trendType === "korea" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              }}
            >
              🇰🇷 한국 트렌드
            </button>
          </div>

          <div style={{ marginBottom: "15px" }}>
            <h3
              style={{
                margin: "0 0 10px 0",
                fontSize: "1rem",
                color: "#212529",
              }}
            >
              {trendType === "hollywood"
                ? "🔥 헐리우드 핫이슈"
                : "📈 실시간 한국 트렌드"}
            </h3>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="text"
                placeholder={
                  trendType === "hollywood"
                    ? "배우/주제 검색..."
                    : "이슈/키워드 검색..."
                }
                value={trendQuery}
                onChange={(e) => setTrendQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTrends()}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  outline: "none",
                }}
              />
              <button
                onClick={fetchTrends}
                disabled={isFetchingTrends}
                style={{
                  padding: "8px 15px",
                  fontSize: "0.85rem",
                  backgroundColor:
                    trendType === "hollywood" ? "#ff4757" : "#03c75a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {isFetchingTrends ? "..." : "검색"}
              </button>
            </div>
          </div>

          <div
            style={{
              height: "262px",
              overflowY: "auto",
              paddingRight: "5px",
              position: "relative",
            }}
          >
            {isFetchingTrends && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  zIndex: 10,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  borderRadius: "8px",
                }}
              >
                <div
                  className="spinner"
                  style={{
                    width: "30px",
                    height: "30px",
                    border: "3px solid #f3f3f3",
                    borderTop: `3px solid ${trendType === "hollywood" ? "#ff4757" : "#03c75a"}`,
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                ></div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: trendType === "hollywood" ? "#ff4757" : "#03c75a",
                    fontWeight: "bold",
                  }}
                >
                  하이브리드 엔진 검색 중...
                </span>
              </div>
            )}

            {trends.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", color: "#adb5bd" }}>
                    추천 토픽 ({trends.length})
                  </span>
                  <button
                    onClick={clearTrends}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#adb5bd",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    초기화
                  </button>
                </div>
                {trends.map((t, i) => (
                  <div
                    key={i}
                    onClick={() => selectTrend(t)}
                    style={{
                      padding: "12px",
                      backgroundColor: "#f8f9fa",
                      border: "1px solid #e9ecef",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor =
                        trendType === "hollywood" ? "#fff5f5" : "#f0fff4";
                      e.currentTarget.style.borderColor =
                        trendType === "hollywood" ? "#feb2b2" : "#9ae6b4";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f9fa";
                      e.currentTarget.style.borderColor = "#e9ecef";
                    }}
                  >
                    <strong
                      style={{
                        fontSize: "0.9rem",
                        display: "block",
                        marginBottom: "4px",
                        color: "#2d3436",
                      }}
                    >
                      {t.topic}
                    </strong>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#636e72",
                        lineHeight: "1.4",
                      }}
                    >
                      {t.summary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#adb5bd",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  border: "2px dashed #f1f3f5",
                  borderRadius: "8px",
                }}
              >
                이슈를 검색하여
                <br />
                빠르게 주제를 선정하세요
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 직접 입력 폼 */}
        <div className="form-section">
          <h3
            style={{ margin: "0 0 20px 0", fontSize: "1rem", color: "#212529" }}
          >
            📝 작업 상세 정보
          </h3>
          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "20px",
              width: "100%",
            }}
          >
            <div className="form-group" style={{ gridColumn: "span 2" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: "6px",
                  fontWeight: "600",
                }}
              >
                포스팅 주제 <span style={{ color: "#ff4757" }}>*</span>
              </label>
              <input
                type="text"
                placeholder="블로그 포스트 주제를 입력하거나 왼쪽 이슈를 클릭하세요"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="form-group">
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: "6px",
                  fontWeight: "600",
                }}
              >
                키워드
              </label>
              <input
                type="text"
                placeholder="쉼표로 구분"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div className="form-group">
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: "6px",
                  fontWeight: "600",
                }}
              >
                카테고리 (선택된 네이버 계정){" "}
                <span style={{ color: "#ff4757" }}>*</span>
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
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        width: "50px",
                        color: "#03c75a",
                      }}
                    >
                      N-1
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
                        outline: "none",
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
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        width: "50px",
                        color: "#03c75a",
                      }}
                    >
                      N-2
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
                        outline: "none",
                      }}
                    />
                  </div>
                )}
                {(!credentials.enableNaver || !credentials.naverId) &&
                  (!credentials.enableNaver2 || !credentials.naverId2) && (
                    <span style={{ fontSize: "0.75rem", color: "#ef4444" }}>
                      사용 가능한 네이버 계정이 플랫폼 설정에 없습니다.
                    </span>
                  )}
              </div>
            </div>

            <div className="form-group">
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: "6px",
                  fontWeight: "600",
                }}
              >
                페르소나 <span style={{ color: "#ff4757" }}>*</span>
              </label>
              <select
                value={persona}
                onChange={(e) => setPersona(e.target.value as Persona)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  backgroundColor: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="informative">분석가 (정보)</option>
                <option value="experiential">리뷰어 (후기)</option>
                <option value="reporter">리포터 (뉴스)</option>
                <option value="entertainment">엔터형 (팬)</option>
                <option value="travel">여행 가이드</option>
              </select>
            </div>

            <div className="form-group">
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  color: "#495057",
                  marginBottom: "6px",
                  fontWeight: "600",
                }}
              >
                톤앤매너 <span style={{ color: "#ff4757" }}>*</span>
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as Tone)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #dee2e6",
                  backgroundColor: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="professional">전문적인 (딱딱한)</option>
                <option value="serious">냉철한 (무게감 있는)</option>
                <option value="incisive">비판적인 (날카로운)</option>
                <option value="empathetic">공감형 (부드러운)</option>
              </select>
            </div>

            <div
              className="form-group"
              style={{
                gridColumn: "span 2",
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                padding: "15px",
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
                  fontSize: "0.95rem",
                  color: "#4338ca",
                  fontWeight: "bold",
                }}
              >
                <input
                  type="checkbox"
                  checked={useNotebookLM}
                  onChange={(e) => setUseNotebookLM(e.target.checked)}
                  style={{ width: "18px", height: "18px" }}
                />
                NotebookLM 전략적 고도화 사용
              </label>

              {useNotebookLM && (
                <div
                  style={{
                    display: "flex",
                    gap: "20px",
                    marginLeft: "26px",
                    padding: "10px",
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                    border: "1px solid #d0d7ff",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="nb-mode"
                      checked={notebookMode === "auto"}
                      onChange={() => setNotebookMode("auto")}
                    />
                    AI 자동 검수 (NotebookLM 엔진)
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.85rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="nb-mode"
                      checked={notebookMode === "manual"}
                      onChange={() => setNotebookMode("manual")}
                    />
                    사용자 직접 검수
                  </label>
                </div>
              )}

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#495057",
                  marginLeft: "5px",
                }}
              >
                <input
                  type="checkbox"
                  checked={useImage}
                  onChange={(e) => setUseImage(e.target.checked)}
                  style={{ width: "16px", height: "16px" }}
                />
                이미지 자동 삽입
              </label>
            </div>

            <div
              style={{
                gridColumn: "span 2",
                textAlign: "right",
                marginTop: "10px",
              }}
            >
              <button
                type="submit"
                style={{
                  padding: "12px 30px",
                  backgroundColor: "#03c75a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(3, 199, 90, 0.2)",
                }}
              >
                대기열에 추가하기
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
