import React, { useState, useEffect } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

interface TaskTableProps {
  tasks: BatchTask[];
  onPersonaChange: (taskIndex: number, newPersona: Persona) => void;
  onToneChnage: (taskIndex: number, newTone: Tone) => void;
}

const personaOptions: { label: string; value: Persona }[] = [
  { label: "분석가 (정보)", value: "informative" },
  { label: "리뷰어 (후기)", value: "experiential" },
  { label: "리포터 (뉴스)", value: "reporter" },
];

const toneOptions: { label: string; value: Tone }[] = [
  { label: "전문적인", value: "professional" },
  { label: "비판적인", value: "incisive" },
  { label: "냉철한", value: "serious" },
];

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  onPersonaChange,
  onToneChnage,
}) => {
  // 펼쳐진 행들의 인덱스를 관리
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // 엑셀 업로드 시 (tasks 배열이 새로 로드될 때) 초기 상태 설정
  useEffect(() => {
    const initialExpanded = new Set<number>();
    tasks.forEach((task, idx) => {
      // '완료'가 아닌 항목들은 기본적으로 펼침
      if (task.status !== "완료") {
        initialExpanded.add(idx);
      }
    });
    setExpandedRows(initialExpanded);
  }, [tasks.length]); // tasks 자체가 아닌 길이 변화로 업로드 시점 감지

  // 진행 중이거나 방금 완료된 항목은 계속 펼쳐져 있도록 유지
  useEffect(() => {
    tasks.forEach((task, idx) => {
      if (task.status === "진행") {
        setExpandedRows(prev => {
          if (prev.has(idx)) return prev;
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
      }
    });
  }, [tasks]);

  const toggleRow = (idx: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="task-table-container" style={{ marginTop: "20px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ backgroundColor: "#f1f3f5", textAlign: "left" }}>
            <th style={{ padding: "12px", width: "40px" }}></th>
            <th style={{ padding: "12px" }}>주제</th>
            <th style={{ padding: "12px" }}>상태</th>
            <th style={{ padding: "12px" }}>키워드</th>
          </tr>
        </thead>
        <tbody>
          {tasks.length > 0 ? (
            tasks.map((task, idx) => {
              const isExpanded = expandedRows.has(idx);
              return (
                <React.Fragment key={idx}>
                  <tr 
                    onClick={() => toggleRow(idx)}
                    style={{ 
                      cursor: "pointer", 
                      borderBottom: "1px solid #dee2e6",
                      backgroundColor: isExpanded ? "#fff" : "#f8f9fa"
                    }}
                  >
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      {isExpanded ? "▼" : "▶"}
                    </td>
                    <td style={{ padding: "12px", fontWeight: isExpanded ? "bold" : "normal" }}>
                      {task.topic}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span className={`status-badge status-${task.status}`} style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                        backgroundColor: task.status === "완료" ? "#d4edda" : task.status === "진행" ? "#cce5ff" : "#e2e3e5",
                        color: task.status === "완료" ? "#155724" : task.status === "진행" ? "#004085" : "#383d41"
                      }}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", color: "#6c757d", fontSize: "0.9rem" }}>
                      {Array.isArray(task.keywords) ? task.keywords.join(", ") : task.keywords || "-"}
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{ backgroundColor: "#fff", borderBottom: "1px solid #dee2e6" }}>
                      <td></td>
                      <td colSpan={3} style={{ padding: "15px 12px 20px 12px" }}>
                        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                          <div className="form-group">
                            <label style={{ display: "block", fontSize: "0.8rem", color: "#adb5bd", marginBottom: "4px" }}>페르소나</label>
                            <select
                              value={task.persona}
                              onChange={(e) =>
                                onPersonaChange(idx, e.target.value as Persona)
                              }
                              style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                            >
                              {personaOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="form-group">
                            <label style={{ display: "block", fontSize: "0.8rem", color: "#adb5bd", marginBottom: "4px" }}>톤앤매너</label>
                            <select
                              value={task.tone}
                              onChange={(e) => onToneChnage(idx, e.target.value as Tone)}
                              style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ced4da" }}
                            >
                              {toneOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="info-group">
                            <label style={{ display: "block", fontSize: "0.8rem", color: "#adb5bd", marginBottom: "4px" }}>카테고리</label>
                            <span style={{ fontSize: "0.9rem" }}>{task.category || "미지정"}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          ) : (
            <tr>
              <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#adb5bd" }}>
                데이터가 없습니다. 파일을 먼저 업로드해주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};