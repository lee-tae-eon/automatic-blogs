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
  logs,
  onClear,
  onStop,
  onPublish,
}) => {
  if (!hasTasks) return null;

  const latestLog = logs[0];

  return (
    <div className="actions">
      <div className="process-log">
        {latestLog && <span>{latestLog}</span>}
      </div>
      <div className="button-group">
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
