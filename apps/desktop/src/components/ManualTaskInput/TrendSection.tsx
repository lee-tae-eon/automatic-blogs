import React from "react";
import { Persona, Tone } from "@blog-automation/core/types/blog";

export interface TrendTopic {
  topic: string;
  summary: string;
  keywords: string[];
  persona?: Persona;
  tone?: Tone;
}

export type TrendCategory = 
  | "hollywood" 
  | "korea" 
  | "tech" 
  | "economy" 
  | "finance"
  | "entertainment" 
  | "life" 
  | "travel" 
  | "health" 
  | "parenting";

interface TrendSectionProps {
  trendType: TrendCategory;
  setTrendType: (type: TrendCategory) => void;
  trends: TrendTopic[];
  setTrends: (trends: TrendTopic[]) => void;
  trendQuery: string;
  setTrendQuery: (query: string) => void;
  isFetchingTrends: boolean;
  fetchTrends: () => void;
  selectTrend: (trend: TrendTopic) => void;
  clearTrends: () => void;
  persona: Persona;
  setPersona: (persona: Persona) => void;
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
  persona,
  setPersona,
}) => {
  const categories: { key: TrendCategory; label: string; icon: string; color: string }[] = [
    { key: "hollywood", label: "헐리우드", icon: "🎬", color: "#ff4757" },
    { key: "korea", label: "한국 트렌드", icon: "🇰🇷", color: "#03c75a" },
    { key: "tech", label: "IT/테크", icon: "💻", color: "#4834d4" },
    { key: "economy", label: "경제/비즈", icon: "💰", color: "#f0932b" },
    { key: "finance", label: "금융/보험", icon: "🏦", color: "#2f3542" },
    { key: "entertainment", label: "연예/방송", icon: "📺", color: "#e056fd" },
    { key: "life", label: "생활/정보", icon: "🏠", color: "#686de0" },
    { key: "travel", label: "여행", icon: "✈️", color: "#22a6b3" },
    { key: "health", label: "건강", icon: "🏥", color: "#eb4d4b" },
    { key: "parenting", label: "육아", icon: "👶", color: "#6ab04c" },
  ];

  return (
    <div
      className="trends-section"
      style={{ 
        borderRight: "1px solid #f1f3f5", 
        paddingRight: "20px", 
        display: "flex", 
        flexDirection: "column",
        height: "100%",
        minHeight: 0
      }}
    >
      {/* 카테고리 탭 (가로 스크롤 가능) */}
      <div
        style={{
          display: "flex",
          marginBottom: "15px",
          backgroundColor: "#f1f3f5",
          borderRadius: "8px",
          padding: "4px",
          overflowX: "auto",
          gap: "4px",
          scrollbarWidth: "none", // Firefox
          msOverflowStyle: "none", // IE
        }}
        className="hide-scrollbar"
      >
        <style>
          {`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => {
              setTrendType(cat.key);
              setTrends([]);
              setTrendQuery(""); // [v10.12] 카테고리 변경 시 검색어 초기화
            }}
            style={{
              padding: "6px 12px",
              fontSize: "0.75rem",
              border: "none",
              borderRadius: "6px",
              backgroundColor: trendType === cat.key ? "#fff" : "transparent",
              color: trendType === cat.key ? cat.color : "#868e96",
              fontWeight: "bold",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0, // 버튼이 압축되지 않도록 고정
              boxShadow: trendType === cat.key ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
              transition: "all 0.2s"
            }}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: "15px" }}>
        <h3
          style={{
            margin: "0 0 10px 0",
            fontSize: "1rem",
            color: "#212529",
          }}
        >
          {categories.find(c => c.key === trendType)?.icon} {categories.find(c => c.key === trendType)?.label} 핫이슈
        </h3>
        <div style={{ display: "flex", gap: "5px" }}>
          <input
            type="text"
            placeholder={
              trendType === "hollywood" || trendType === "korea"
                ? "주제/키워드 검색..."
                : `${categories.find(c => c.key === trendType)?.label} 관련 검색 (비워두면 자동 추천)`
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
              backgroundColor: categories.find(c => c.key === trendType)?.color || "#03c75a",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isFetchingTrends ? "..." : "추천받기"}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
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
                borderTop: `3px solid ${categories.find(c => c.key === trendType)?.color || "#03c75a"}`,
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
            <span
              style={{
                fontSize: "0.85rem",
                color: categories.find(c => c.key === trendType)?.color || "#03c75a",
                fontWeight: "bold",
              }}
            >
              트렌드 수집 및 AI 분석 중...
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
                  e.currentTarget.style.backgroundColor = "#f1f3f5";
                  e.currentTarget.style.borderColor = categories.find(c => c.key === trendType)?.color || "#dee2e6";
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
                {(t.persona || t.tone) && (
                  <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                    {t.persona && (
                      <span style={{ 
                        fontSize: "0.65rem", 
                        backgroundColor: "#edf2ff", 
                        color: "#4c6ef5", 
                        padding: "2px 6px", 
                        borderRadius: "4px",
                        fontWeight: "bold"
                      }}>
                        👤 {t.persona === "informative" ? "분석가" : 
                            t.persona === "experiential" ? "리뷰어" : 
                            t.persona === "reporter" ? "리포터" : 
                            t.persona === "entertainment" ? "팬/엔터" : 
                            t.persona === "travel" ? "가이드" : 
                            t.persona === "financeMaster" ? "금융전문가" : 
                            t.persona === "healthExpert" ? "건강전문가" : t.persona}
                      </span>
                    )}
                    {t.tone && (
                      <span style={{ 
                        fontSize: "0.65rem", 
                        backgroundColor: "#fff0f6", 
                        color: "#d6336c", 
                        padding: "2px 6px", 
                        borderRadius: "4px",
                        fontWeight: "bold"
                      }}>
                        ✨ {t.tone === "professional" ? "전문적" : 
                            t.tone === "serious" ? "냉철" : 
                            t.tone === "incisive" ? "비판적" : 
                            t.tone === "empathetic" ? "공감" : t.tone}
                      </span>
                    )}
                  </div>
                )}
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
            카테고리를 선택하고
            <br />
            추천받기 버튼을 눌러보세요
          </div>
        )}
      </div>
    </div>
  );
};
