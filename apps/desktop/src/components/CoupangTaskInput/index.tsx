import React, { useState } from "react";
import { BatchTask } from "@blog-automation/core/types/blog";

interface CoupangTaskInputProps {
  onAddTask: (task: BatchTask) => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CoupangTaskInput: React.FC<CoupangTaskInputProps> = ({
  onAddTask,
  credentials,
  onChange,
}) => {
  const [coupangLink, setCoupangLink] = useState("");
  const [topic, setTopic] = useState("");
  const defaultAccount = credentials.enableNaver ? "naver1" : "naver2";
  const [targetAccount, setTargetAccount] = useState<"naver1" | "naver2">(defaultAccount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!coupangLink.trim()) {
      alert("쿠팡 파트너스 링크를 입력해주세요.");
      return;
    }
    if (!topic.trim()) {
      alert("작업 식별용 주제(상품명 등)를 간단히 입력해주세요.");
      return;
    }

    // Rule 2: 페르소나는 "experiential"(후기형), 톤은 "empathetic"(사용자입장/공감형) 강제 고정
    const newTask: BatchTask = {
      topic: topic.trim(),
      keywords: [],
      category: "쿠팡 파트너스 (자동 리뷰)",
      persona: "experiential",
      tone: "empathetic",
      useImage: true, 
      coupangLink: coupangLink.trim(),
      targetAccount,
      naverCategory: credentials.naverCategory,
      naverCategory2: credentials.naverCategory2,
      status: "대기",
    };

    onAddTask(newTask);

    // 폼 초기화
    setCoupangLink("");
    setTopic("");
  };

  return (
    <div
      className="coupang-input-container"
      style={{
        backgroundColor: "#fff0f2", // 쿠팡 테마와 유사한 색상으로 분리감 제공
        borderRadius: "12px",
        border: "1px solid #ffccd5",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <h3 style={{ margin: "0 0 15px 0", fontSize: "1.1rem", color: "#e63946" }}>
        🛒 쿠팡 파트너스 전용 자동 포스팅
      </h3>
      <p style={{ fontSize: "0.85rem", color: "#6c757d", marginBottom: "20px" }}>
        링크만 입력하면 AI가 직접 상품 페이지를 분석하여 "전문 리뷰어(후기형)" 페르소나로 포스팅을 작성합니다.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div className="form-group" style={{ gridColumn: "span 2" }}>
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px" }}>
            쿠팡 상품 링크 (단축 링크 지원) <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            placeholder="https://link.coupang.com/a/..."
            value={coupangLink}
            onChange={(e) => setCoupangLink(e.target.value)}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #ffb3c1",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div className="form-group">
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px" }}>
            식별용 주제 (상품 간략명) <span style={{ color: "red" }}>*</span>
          </label>
          <input
           type="text"
           placeholder="예: 애플 2026 맥북 프로 14"
           value={topic}            onChange={(e) => setTopic(e.target.value)}
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
          <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "bold", marginBottom: "8px" }}>
            발행 타겟 계정 선택 <span style={{ color: "red" }}>*</span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {credentials.enableNaver && credentials.naverId && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.9rem", minWidth: "120px" }}>
                  <input
                    type="radio"
                    name="targetAccount"
                    value="naver1"
                    checked={targetAccount === "naver1"}
                    onChange={() => setTargetAccount("naver1")}
                  />
                  N-1 ({credentials.naverId})
                </label>
                <input
                  type="text"
                  name="naverCategory"
                  value={credentials.naverCategory}
                  onChange={onChange}
                  placeholder="N-1 발행 카테고리"
                  disabled={targetAccount !== "naver1"}
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #dee2e6", fontSize: "0.85rem", opacity: targetAccount === "naver1" ? 1 : 0.5 }}
                />
              </div>
            )}
            {credentials.enableNaver2 && credentials.naverId2 && (
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontSize: "0.9rem", minWidth: "120px" }}>
                  <input
                    type="radio"
                    name="targetAccount"
                    value="naver2"
                    checked={targetAccount === "naver2"}
                    onChange={() => setTargetAccount("naver2")}
                  />
                  N-2 ({credentials.naverId2})
                </label>
                <input
                  type="text"
                  name="naverCategory2"
                  value={credentials.naverCategory2}
                  onChange={onChange}
                  placeholder="N-2 발행 카테고리"
                  disabled={targetAccount !== "naver2"}
                  style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #dee2e6", fontSize: "0.85rem", opacity: targetAccount === "naver2" ? 1 : 0.5 }}
                />
              </div>
            )}
            {(!credentials.enableNaver || !credentials.naverId) &&
             (!credentials.enableNaver2 || !credentials.naverId2) && (
                <span style={{ fontSize: "0.8rem", color: "red" }}>사용 가능한 네이버 계정이 없습니다.</span>
            )}
          </div>
        </div>

        <div style={{ gridColumn: "span 2", textAlign: "right", marginTop: "10px" }}>
          <button
            type="submit"
            style={{
              padding: "12px 30px",
              backgroundColor: "#e63946",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(230, 57, 70, 0.3)",
            }}
          >
            대기열에 추가하기
          </button>
        </div>
      </form>
    </div>
  );
};
