import { BatchTask } from "@blog-automation/core/types/blog";
import React, { useState, useRef } from "react";

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
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
      <div
        className="drop-zone"
        onClick={handleZoneClick}
        style={{ cursor: "pointer", marginBottom: "30px" }}
      >
        <p>📁 클릭하여 엑셀 파일을 선택하세요.</p>
        <span style={{ fontSize: "12px", color: "#888" }}>
          지원 형식: .xlsx, .csv
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>주제</th>
            <th>페르소나</th>
            <th>카테고리</th>
            <th>키워드</th>
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
                <td className={`status-${task.status}`}>{task.status}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", padding: "20px" }}>
                데이터가 없습니다. 파일을 먼저 업로드해주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
