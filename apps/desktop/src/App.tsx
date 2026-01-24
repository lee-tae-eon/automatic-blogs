import { BatchTask } from "@blog-automation/core/types/blog";
import React, { useState } from "react";
// core에서 정의한 인터페이스 재사용

export const App: React.FC = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    // Electron 메인 프로세스에 파일 경로 전달 (실제 경로는 path 속성에 있음)
    // @ts-ignore (Electron 환경의 file 객체 확장 속성 사용)
    const filePath = file.path;

    // ipcRenderer를 통한 데이터 요청
    const parsedTasks = await (window as any).ipcRenderer.invoke(
      "parse-excel",
      filePath,
    );
    setTasks(parsedTasks);
  };

  return (
    <div
      className="container"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleFileDrop}
    >
      <h1>🚀 AI 블로그 대량 발행기 (Desktop)</h1>
      <div className="drop-zone">엑셀 파일을 드래그하여 업로드하세요.</div>

      <table>
        <thead>
          <tr>
            <th>주제</th>
            <th>페르소나</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, idx) => (
            <tr key={idx}>
              <td>{task.topic}</td>
              <td>{task.persona}</td>
              <td>{task.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
