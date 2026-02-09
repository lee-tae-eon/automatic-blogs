import React, { useState } from "react";

interface AutoPilotControlProps {
  isProcessing: boolean;
  candidates: any[];
  onFetch: (topic: string) => void;
  onStart: (analysis: any) => void;
}

export const AutoPilotControl: React.FC<AutoPilotControlProps> = ({
  isProcessing,
  candidates,
  onFetch,
  onStart,
}) => {
  const [topic, setTopic] = useState("");

  const handleFetch = () => {
    if (!topic.trim()) {
      alert("주제를 입력해주세요.");
      return;
    }
    onFetch(topic.trim());
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
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.2rem" }}>🧠</span>
        <h2 style={{ fontSize: "1rem", margin: 0, color: "#4338ca" }}>
          v2.0 Autonomous Auto-Pilot (주제 확장 및 선택)
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
          onKeyDown={(e) => e.key === "Enter" && handleFetch()}
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
            backgroundColor: isProcessing ? "#94a3b8" : "#6366f1",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0 25px",
            fontWeight: "bold",
            cursor: isProcessing ? "not-allowed" : "pointer",
          }}
        >
          {isProcessing && candidates.length === 0 ? "분석 중..." : "황금 키워드 발굴"}
        </button>
      </div>

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
                        padding: "2px 8px", 
                        borderRadius: "12px", 
                        backgroundColor: c.score >= 60 ? "#dcfce7" : "#fee2e2",
                        color: c.score >= 60 ? "#166534" : "#991b1b",
                        fontWeight: "bold"
                      }}>
                        {c.score}점
                      </span>
                    </td>
                    <td style={{ padding: "10px", textAlign: "center" }}>
                      <button
                        onClick={() => onStart(c)}
                        disabled={isProcessing}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "6px",
                          backgroundColor: "#4f46e5",
                          color: "white",
                          border: "none",
                          fontSize: "0.75rem",
                          cursor: isProcessing ? "not-allowed" : "pointer"
                        }}
                      >
                        발행하기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};