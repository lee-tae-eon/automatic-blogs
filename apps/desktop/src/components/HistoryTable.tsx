import React from "react";

interface HistoryItem {
  id: number;
  title: string;
  url: string;
  keywords: string;
  category: string;
  account: string;
  persona: string;
  tone: string;
  views: number;
  likes: number;
  comments: number;
  published_at: string;
}

interface HistoryTableProps {
  history: HistoryItem[];
  onRefresh: () => void;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({ history, onRefresh }) => {
  return (
    <div className="history-table-container" style={{ marginTop: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
        <h2 style={{ fontSize: "1.1rem", margin: 0, color: "#333" }}>📋 최근 발행 내역</h2>
        <button 
          onClick={onRefresh}
          style={{
            padding: "5px 12px",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "0.85rem",
            cursor: "pointer"
          }}
        >
          🔄 새로고침
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ backgroundColor: "#f1f3f5", textAlign: "left" }}>
            <th style={{ padding: "12px", width: "150px" }}>발행일시</th>
            <th style={{ padding: "12px", width: "100px" }}>계정</th>
            <th style={{ padding: "12px" }}>제목</th>
            <th style={{ padding: "12px", width: "80px" }}>조회수</th>
            <th style={{ padding: "12px", width: "80px" }}>이동</th>
          </tr>
        </thead>
        <tbody>
          {history.length > 0 ? (
            history.map((item) => (
              <tr key={item.id} style={{ borderBottom: "1px solid #dee2e6" }}>
                <td style={{ padding: "12px", color: "#666" }}>
                  {new Date(item.published_at).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </td>
                <td style={{ padding: "12px" }}>
                  <span style={{ 
                    fontSize: "0.8rem", 
                    padding: "2px 6px", 
                    backgroundColor: "#e9ecef", 
                    borderRadius: "4px" 
                  }}>
                    {item.account || "N/A"}
                  </span>
                </td>
                <td style={{ padding: "12px", fontWeight: "500" }}>
                  {item.title}
                  <div style={{ fontSize: "0.75rem", color: "#adb5bd", marginTop: "4px" }}>
                    {item.persona} / {item.tone}
                  </div>
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  {item.views.toLocaleString()}
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      textDecoration: "none", 
                      color: "#007aff",
                      fontSize: "0.85rem"
                    }}
                  >
                    보기 ↗
                  </a>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#adb5bd" }}>
                발행 내역이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
