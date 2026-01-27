import React from "react";
import { BatchTask } from "@blog-automation/core/types/blog";

interface TaskTableProps {
  tasks: BatchTask[];
}

export const TaskTable: React.FC<TaskTableProps> = ({ tasks }) => {
  return (
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
  );
};
