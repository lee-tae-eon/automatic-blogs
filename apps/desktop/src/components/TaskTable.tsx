import React from "react";
import { BatchTask, Persona } from "@blog-automation/core/types/blog";

interface TaskTableProps {
  tasks: BatchTask[];
  onPersonaChange: (taskIndex: number, newPersona: Persona) => void;
}

const personaOptions: { label: string; value: Persona }[] = [
  { label: "공감형", value: "empathetic" },
  { label: "스토리텔링형", value: "storytelling" },
  { label: "친근형", value: "friendly" },
  { label: "체험형", value: "experiential" },
];

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  onPersonaChange,
}) => {
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
              <td>
                <select
                  value={task.persona}
                  onChange={(e) =>
                    onPersonaChange(idx, e.target.value as Persona)
                  }
                >
                  {personaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
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
