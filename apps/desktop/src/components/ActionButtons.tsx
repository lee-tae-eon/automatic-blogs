import React from "react";

interface ActionButtonsProps {
  hasTasks: boolean;
  isProcessing: boolean;
  logs: string[];
  onClear: () => void;
  onStop: () => void;
  onPublish: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  hasTasks,
  isProcessing,
  onClear,
  onStop,
  onPublish,
}) => {
  if (!hasTasks) return null;

  return (
    <div 
      className="actions" 
      style={{ 
        display: "flex", 
        justifyContent: "flex-end", // 버튼을 우측으로 정렬
        alignItems: "center",
        backgroundColor: "#f8f9fa",
        padding: "12px 20px",
        borderRadius: "8px",
        border: "1px solid #e9ecef",
        marginBottom: "20px"
      }}
    >
      <div className="button-group" style={{ display: "flex", gap: "12px" }}>
        <button
          className="btn-secondary"
          onClick={onClear}
          disabled={isProcessing}
        >
          목록 삭제
        </button>
        {isProcessing ? (
          <button className="btn-danger" onClick={onStop}>
            ⛔ 작업 중지
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={onPublish}
            disabled={isProcessing}
          >
            일괄 발행 시작
          </button>
        )}
      </div>
    </div>
  );
};
