import React from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

interface TaskTableProps {
  tasks: BatchTask[];
  onPersonaChange: (taskIndex: number, newPersona: Persona) => void;
  onToneChnage: (taskIndex: number, newTone: Tone) => void;
}

const personaOptions: { label: string; value: Persona }[] = [
  { label: "정보공유형", value: "informative" },
  { label: "공감형", value: "empathetic" },
  { label: "스토리텔링형", value: "storytelling" },
  { label: "친근형", value: "friendly" },
  { label: "체험형", value: "experiential" },
];

const toneOptions: { label: string; value: Tone }[] = [
  { label: "전문적인", value: "professional" },
  { label: "비판적인", value: "incisive" },
  { label: "재치있는", value: "witty" },
  { label: "솔직담백한", value: "candid" },
  { label: "활기찬", value: "energetic" },
  { label: "냉철한", value: "serious" },
];

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  onPersonaChange,
  onToneChnage,
}) => {
  return (
    <table>
      <thead>
        <tr>
          <th>주제</th>
          <th>페르소나</th>
          <th>톤</th>
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
              <td>
                <select
                  value={task.tone}
                  onChange={(e) => onToneChnage(idx, e.target.value as Tone)}
                >
                  {toneOptions.map((option) => (
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
