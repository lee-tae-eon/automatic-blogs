import { BatchTask } from "@blog-automation/core/types/blog";
import React, { useState, useRef } from "react";
import "./App.scss";

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null); // input 참조를 위한 ref

  /**
   * 선택된 파일을 처리하여 Electron Main 프로세스로 전송합니다.
   * @param file - 선택된 File 객체
   */
  const processFile = async (file: File) => {
    // Preload 스크립트를 통해 실제 파일 경로 가져오기
    if (typeof window.ipcRenderer?.getFilePath !== "function") {
      console.error(
        "IPC Error: getFilePath function missing",
        window.ipcRenderer,
      );
      alert(
        "Electron 초기화 오류: 앱을 재시작하거나 빌드를 다시 실행해주세요.",
      );
      return;
    }

    const filePath = window.ipcRenderer.getFilePath(file);

    if (!filePath) {
      alert(
        "파일 경로를 찾을 수 없습니다.\nElectron 앱에서 실행 중인지 확인해주세요.",
      );
      return;
    }

    try {
      const result = await window.ipcRenderer.invoke("parse-excel", filePath);
      console.log(result);
      if (result.success) {
        setTasks(result.data);
      } else {
        alert(result.error || "파일 분석에 실패했습니다.");
      }
    } catch (error) {
      console.error("파일 처리 중 오류 발생:", error);
      alert("파일 처리 중 오류가 발생했습니다.");
    }
  };

  /**
   * 파일 입력 변경 이벤트 핸들러 (클릭하여 파일 선택 시)
   * @param e - ChangeEvent 객체
   */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  /**
   * 드롭존 클릭 핸들러
   * 숨겨진 file input 요소를 클릭하여 파일 선택 창을 엽니다.
   */
  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * 목록 초기화 핸들러
   */
  const handleClearAll = () => {
    if (isProcessing) return;
    if (confirm("업로드된 목록을 모두 삭제하시겠습니까?")) {
      setTasks([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /**
   * 일괄 발행 버튼 핸들러
   * 목록에 있는 모든 작업을 순차적으로 실행합니다.
   */
  const handlePublishAll = async () => {
    if (isProcessing || tasks.length === 0) return;

    if (!confirm("모든 항목에 대해 블로그 발행을 시작하시겠습니까?")) return;

    setIsProcessing(true);
    const newTasks = [...tasks];

    for (let i = 0; i < newTasks.length; i++) {
      // 이미 완료된 작업은 건너뜀
      if (newTasks[i].status === "완료") continue;

      // 상태 업데이트: 진행중
      newTasks[i] = { ...newTasks[i], status: "진행" };
      setTasks([...newTasks]);

      try {
        // 1. 포스트 생성 요청
        const genResult = await window.ipcRenderer.invoke(
          "generate-post",
          newTasks[i],
        );
        if (!genResult.success) throw new Error(genResult.error || "생성 실패");

        // 2. 발행 요청
        const pubResult = await window.ipcRenderer.invoke(
          "publish-post",
          genResult.data,
        );
        if (!pubResult.success) throw new Error(pubResult.error || "발행 실패");

        newTasks[i] = { ...newTasks[i], status: "완료" };
      } catch (error) {
        console.error(error);
        newTasks[i] = { ...newTasks[i], status: "실패" };
      }
      setTasks([...newTasks]);
    }
    setIsProcessing(false);
    alert("모든 작업이 종료되었습니다.");
  };

  return (
    <div className="container">
      <h1>🚀 AI 블로그 대량 발행기 (Desktop)</h1>

      {/* 숨겨진 파일 인풋 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        style={{ display: "none" }}
      />

      {/* 클릭 가능한 드롭존 (실제로는 버튼 역할) */}
      <div className="drop-zone" onClick={handleZoneClick}>
        <p>📁 클릭하여 엑셀 파일을 선택하세요.</p>
        <span>지원 형식: .xlsx, .csv</span>
      </div>

      {/* 액션 버튼 영역 */}
      {tasks.length > 0 && (
        <div className="actions">
          <button
            className="btn-secondary"
            onClick={handleClearAll}
            disabled={isProcessing}
          >
            목록 삭제
          </button>
          <button
            className="btn-primary"
            onClick={handlePublishAll}
            disabled={isProcessing}
          >
            {isProcessing ? "발행 진행 중..." : "일괄 발행 시작"}
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>주제</th>
            <th>페르소나</th>
            <th>카테고리</th>
            <th>키워드</th>
            <th>플랫폼</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length > 0 ? (
            tasks.map((task, idx) => (
              <tr key={idx}>
                <td>{task.topic}</td>
                <td>{task.persona}</td>
                <td>{task.category}</td>
                <td>{task.keywords || "-"}</td>
                <td>{task.platform || "-"}</td>
                <td className={`status-${task.status}`}>{task.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="empty-message">
                데이터가 없습니다. 파일을 먼저 업로드해주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
