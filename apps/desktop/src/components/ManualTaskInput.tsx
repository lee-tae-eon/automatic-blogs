import React, { useState } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

interface ManualTaskInputProps {
  onAddTask: (task: BatchTask) => void;
}

interface TrendTopic {
  topic: string;
  summary: string;
  keywords: string[];
}

export const ManualTaskInput: React.FC<ManualTaskInputProps> = ({ onAddTask }) => {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("일상정보");
  const [persona, setPersona] = useState<Persona>("informative");
  const [tone, setTone] = useState<Tone>("professional");
  
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [trendQuery, setTrendQuery] = useState("");
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);

  const fetchTrends = async () => {
    setIsFetchingTrends(true);
    // 잦은 호출 방지를 위해 로딩 중엔 버튼 클릭만 막고 리스트는 유지하거나 교체
    try {
      const result = await window.ipcRenderer.invoke("fetch-hollywood-trends", trendQuery);
      if (result && result.success) {
        setTrends(result.data);
      } else {
        alert("트렌드를 가져오지 못했습니다: " + (result?.error || "알 수 없는 오류"));
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
    setCategory("해외연예");
    setPersona("hollywood-reporter");
    setTone("witty");
    // 선택 후 리스트를 바로 없애지 않음 (사용자 요청)
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
      category,
      persona,
      tone,
      status: "대기",
    };

    onAddTask(newTask);
    
    // 폼 초기화
    setTopic("");
    setKeywords("");
  };

  return (
    <div className="manual-input-card" style={{ 
      padding: "20px", 
      backgroundColor: "#fff", 
      borderRadius: "8px", 
      border: "1px solid #dee2e6",
      marginBottom: "20px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", gap: "10px" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", whiteSpace: "nowrap" }}>📝 직접 작업 추가</h3>
        <div style={{ display: "flex", gap: "5px", flex: 1, justifyContent: "flex-end" }}>
          <input 
            type="text" 
            placeholder="배우 이름 또는 주제 (선택)" 
            value={trendQuery}
            onChange={(e) => setTrendQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTrends()}
            style={{ 
              padding: "6px 10px", 
              fontSize: "0.8rem", 
              borderRadius: "4px", 
              border: "1px solid #ced4da",
              width: "180px"
            }}
          />
          <button 
            onClick={fetchTrends}
            disabled={isFetchingTrends}
            style={{ 
              padding: "6px 12px", 
              fontSize: "0.8rem", 
              backgroundColor: "#ff4757", 
              color: "#fff", 
              border: "none", 
              borderRadius: "4px",
              cursor: "pointer",
              opacity: isFetchingTrends ? 0.6 : 1,
              whiteSpace: "nowrap"
            }}
          >
            {isFetchingTrends ? "🔍 분석 중..." : "🔥 이슈 찾기"}
          </button>
        </div>
      </div>

      {trends.length > 0 && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "10px", 
          backgroundColor: "#fff5f5", 
          borderRadius: "6px", 
          border: "1px solid #feb2b2",
          position: "relative"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: "bold", color: "#c53030" }}>추천 토픽 (클릭 시 자동 입력)</p>
            <button 
              onClick={clearTrends}
              style={{ background: "none", border: "none", color: "#e53e3e", fontSize: "0.75rem", cursor: "pointer", textDecoration: "underline" }}
            >
              닫기
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {trends.map((t, i) => (
              <div 
                key={i} 
                onClick={() => selectTrend(t)}
                style={{ 
                  padding: "8px", 
                  backgroundColor: "#fff", 
                  border: "1px solid #fed7d7", 
                  borderRadius: "4px", 
                  cursor: "pointer",
                  fontSize: "0.85rem"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#fff5f5"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
              >
                <strong>{t.topic}</strong>
                <div style={{ fontSize: "0.75rem", color: "#718096", marginTop: "2px" }}>{t.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "5px" }}>주제 (Topic)</label>
          <input
            type="text"
            placeholder="블로그 포스트 주제를 입력하세요"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          />
        </div>
        
        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "5px" }}>키워드 (쉼표로 구분)</label>
          <input
            type="text"
            placeholder="키워드1, 키워드2..."
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          />
        </div>

        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "5px" }}>카테고리</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          />
        </div>

        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "5px" }}>페르소나</label>
          <select 
            value={persona} 
            onChange={(e) => setPersona(e.target.value as Persona)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value="informative">정보형</option>
            <option value="empathetic">공감형</option>
            <option value="storytelling">스토리텔링형</option>
            <option value="friendly">친근형</option>
            <option value="experiential">체험형</option>
            <option value="travelLog">여행기</option>
            <option value="hollywood-reporter">헐리우드특파원</option>
          </select>
        </div>

        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "5px" }}>톤앤매너</label>
          <select 
            value={tone} 
            onChange={(e) => setTone(e.target.value as Tone)}
            style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ced4da" }}
          >
            <option value="professional">전문적인</option>
            <option value="witty">재치있는</option>
            <option value="candid">솔직담백한</option>
            <option value="energetic">활기찬</option>
            <option value="serious">냉철한</option>
            <option value="incisive">비판적인</option>
          </select>
        </div>

        <div style={{ gridColumn: "span 2", textAlign: "right" }}>
          <button 
            type="submit"
            style={{ 
              padding: "10px 20px", 
              backgroundColor: "#03c75a", 
              color: "#fff", 
              border: "none", 
              borderRadius: "4px", 
              fontWeight: "bold",
              cursor: "pointer"
            }}
          >
            추가하기
          </button>
        </div>
      </form>
    </div>
  );
};
