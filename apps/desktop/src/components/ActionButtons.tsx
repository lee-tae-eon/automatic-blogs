import React from "react";

interface ActionButtonsProps {
  hasTasks: boolean;
  isProcessing: boolean;
  logs: string[];
  onClear: () => void;
  onStop: () => void;
  onPublish: () => void;
  onFileUpload: (file: File) => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  hasTasks,
  isProcessing,
  onClear,
  onStop,
  onPublish,
  onFileUpload,
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div 
      className="actions" 
      style={{ 
        display: "flex", 
        justifyContent: "space-between", // 양쪽 정렬
        alignItems: "center",
        backgroundColor: "#f8f9fa",
        padding: "12px 20px",
        borderRadius: "8px",
        border: "1px solid #e9ecef",
        marginBottom: "20px"
      }}
    >
      {/* 왼쪽: 엑셀 업로드 버튼 */}
      <div className="upload-section">
        <label 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px",
            padding: "8px 15px",
            backgroundColor: "#fff",
            border: "1px solid #dee2e6",
            borderRadius: "6px",
            fontSize: "0.85rem",
            cursor: "pointer",
            color: "#495057",
            fontWeight: "500",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f1f3f5"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#fff"}
        >
          📁 엑셀 업로드
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            onChange={handleFileChange} 
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* 오른쪽: 제어 버튼들 */}
      {hasTasks && (
        <div className="button-group" style={{ display: "flex", gap: "12px" }}>
          <button
            className="btn-secondary"
            onClick={onClear}
            disabled={isProcessing}
            style={{ padding: "8px 15px", fontSize: "0.85rem", border: "1px solid #dee2e6", borderRadius: "6px", backgroundColor: "#fff", cursor: "pointer" }}
          >
            목록 삭제
          </button>
          {isProcessing ? (
            <button 
              className="btn-danger" 
              onClick={onStop}
              style={{ padding: "8px 15px", fontSize: "0.85rem", backgroundColor: "#fa5252", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              ⛔ 작업 중지
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={onPublish}
              disabled={isProcessing}
              style={{ padding: "8px 15px", fontSize: "0.85rem", backgroundColor: "#03c75a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}
            >
              일괄 발행 시작
            </button>
          )}
        </div>
      )}
    </div>
  );
};
