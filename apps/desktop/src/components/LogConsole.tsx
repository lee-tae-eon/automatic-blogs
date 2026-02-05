import React, { useEffect, useRef } from "react";

interface LogConsoleProps {
  logs: string[];
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 새로운 로그가 추가될 때마다 하단으로 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-console-container" style={{ marginTop: "20px" }}>
      <div 
        style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          marginBottom: "8px",
          color: "#6c757d",
          fontSize: "0.85rem",
          fontWeight: "bold"
        }}
      >
        <span>실행 로그 (Log Console)</span>
        <span>{logs.length} entries</span>
      </div>
      <div
        ref={scrollRef}
        style={{
          padding: "15px",
          backgroundColor: "#1e1e1e",
          color: "#d4d4d4",
          borderRadius: "8px",
          height: "180px",
          overflowY: "auto",
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontSize: "0.85rem",
          lineHeight: "1.5",
          border: "1px solid #333",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)"
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: "#555" }}>대기 중... 작업을 시작하면 로그가 여기에 표시됩니다.</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: "2px", borderBottom: "1px solid #2a2a2a", paddingBottom: "2px" }}>
              <span style={{ color: "#569cd6", marginRight: "8px" }}>&gt;</span>
              {log}
            </div>
          )).reverse() // 최신 로그가 아래로 가게 하되 데이터는 위에서부터 쌓으려면 reverse 사용 (또는 useAppViewModel의 slice 순서에 따라 조정)
        )}
      </div>
    </div>
  );
};
