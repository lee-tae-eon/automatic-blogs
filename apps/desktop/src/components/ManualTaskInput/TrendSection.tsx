import React from "react";

export interface TrendTopic {
  topic: string;
  summary: string;
  keywords: string[];
}

interface TrendSectionProps {
  trendType: "hollywood" | "korea";
  setTrendType: (type: "hollywood" | "korea") => void;
  trends: TrendTopic[];
  setTrends: (trends: TrendTopic[]) => void;
  trendQuery: string;
  setTrendQuery: (query: string) => void;
  isFetchingTrends: boolean;
  fetchTrends: () => void;
  selectTrend: (trend: TrendTopic) => void;
  clearTrends: () => void;
}

export const TrendSection: React.FC<TrendSectionProps> = ({
  trendType,
  setTrendType,
  trends,
  setTrends,
  trendQuery,
  setTrendQuery,
  isFetchingTrends,
  fetchTrends,
  selectTrend,
  clearTrends,
}) => {
  return (
    <div
      className="trends-section"
      style={{ borderRight: "1px solid #f1f3f5", paddingRight: "20px", display: "flex", flexDirection: "column" }}
    >
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
            backgroundColor: trendType === "hollywood" ? "#fff" : "transparent",
            color: trendType === "hollywood" ? "#ff4757" : "#868e96",
            fontWeight: "bold",
            cursor: "pointer",
            boxShadow:
              trendType === "hollywood" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
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
          flex: 1,
          minHeight: "450px", // Increased base height to better fit items
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
  );
};
