import React from "react";
import { Persona, Tone } from "@blog-automation/core/types/blog";

interface TaskFormSectionProps {
  topic: string;
  setTopic: (val: string) => void;
  keywords: string;
  setKeywords: (val: string) => void;
  persona: Persona;
  setPersona: (val: Persona) => void;
  tone: Tone;
  setTone: (val: Tone) => void;
  useImage: boolean;
  setUseImage: (val: boolean) => void;
  heroImagePath: string;
  setHeroImagePath: (val: string) => void;
  useNotebookLM: boolean;
  setUseNotebookLM: (val: boolean) => void;
  notebookMode: "manual" | "auto";
  setNotebookMode: (val: "manual" | "auto") => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export const TaskFormSection: React.FC<TaskFormSectionProps> = ({
  topic,
  setTopic,
  keywords,
  setKeywords,
  persona,
  setPersona,
  tone,
  setTone,
  useImage,
  setUseImage,
  heroImagePath,
  setHeroImagePath,
  useNotebookLM,
  setUseNotebookLM,
  notebookMode,
  setNotebookMode,
  credentials,
  onChange,
  handleSubmit,
}) => {
  return (
    <div className="form-section">
      <h3 style={{ margin: "0 0 20px 0", fontSize: "1rem", color: "#212529" }}>
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
            <option value="financeMaster">재테크 (금융)</option>
            <option value="healthExpert">건강형 (의학)</option>
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
            이미지 자동 삽입 (Pexels / 안티그래비티)
          </label>

          {useImage && (
            <div style={{ marginLeft: "26px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginBottom: "4px",
                }}
              >
                🖼️ 대표 이미지 직접 선택
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="이미지 파일을 선택하거나 경로를 입력하세요"
                  value={heroImagePath}
                  onChange={(e) => setHeroImagePath(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const result = await (window as any).ipcRenderer.invoke("select-image");
                    if (result && result.success) {
                      setHeroImagePath(result.filePath);
                    }
                  }}
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  파일 선택
                </button>
              </div>
              <p style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "4px" }}>
                * 미선택 시 'blogcategoryinfoimage' 폴더 감지 또는 Pexels를 사용합니다.
              </p>
            </div>
          )}
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
  );
};
