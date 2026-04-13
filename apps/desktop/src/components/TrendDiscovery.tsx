import React from "react";
import { TrendSection, TrendTopic, TrendCategory } from "./ManualTaskInput/TrendSection";
import { Persona } from "@blog-automation/core/types/blog";

interface TrendDiscoveryProps {
  trendType: TrendCategory;
  setTrendType: (type: TrendCategory) => void;
  trends: TrendTopic[];
  setTrends: (trends: TrendTopic[]) => void;
  trendQuery: string;
  setTrendQuery: (query: string) => void;
  isFetchingTrends: boolean;
  fetchTrends: () => Promise<void>;
  selectTrend: (trend: TrendTopic) => void;
  clearTrends: () => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
}

/**
 * [v11.2] 기존 AutoPilotControl을 대체하는 통합 트렌드 탐색 컴포넌트
 * TrendSection을 메인 상단으로 끌어올리고 AutoPilot의 디자인 언어를 적용함
 */
export const TrendDiscovery: React.FC<TrendDiscoveryProps> = (props) => {
  return (
    <div
      className="trend-discovery-container"
      style={{
        backgroundColor: "#f5f7ff",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "20px",
        border: "2px solid #6366f1",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* 장식용 배경 요소 */}
      <div style={{
        position: "absolute",
        top: "-20px",
        right: "-20px",
        fontSize: "5rem",
        opacity: 0.05,
        transform: "rotate(15deg)",
        pointerEvents: "none"
      }}>
        🚀
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
        <span style={{ fontSize: "1.2rem" }}>🔥</span>
        <h2 style={{ fontSize: "1.1rem", margin: 0, color: "#4338ca", fontWeight: "800" }}>
          실시간 트렌드 및 핫이슈 탐색
        </h2>
        <div style={{ 
          marginLeft: "auto", 
          fontSize: "0.75rem", 
          backgroundColor: "#eef2ff", 
          color: "#6366f1", 
          padding: "4px 10px", 
          borderRadius: "20px",
          fontWeight: "bold"
        }}>
          Powered by AI & Real-time Search
        </div>
      </div>

      <div style={{ minHeight: "350px", display: "flex", flexDirection: "column" }}>
        <TrendSection {...props} />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .trend-discovery-container button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
};
