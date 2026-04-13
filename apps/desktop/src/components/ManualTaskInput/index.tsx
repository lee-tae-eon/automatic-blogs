import React from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";
import { TaskFormSection } from "./TaskFormSection";

interface ManualTaskInputProps {
  onAddTask: (task: BatchTask) => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  // [v11.2] 상위에서 관리되는 상태와 연동
  topic: string;
  setTopic: (val: string) => void;
  keywords: string;
  setKeywords: (val: string) => void;
  persona: Persona;
  setPersona: (val: Persona) => void;
  tone: Tone;
  setTone: (val: Tone) => void;
  useImage: boolean;
  setUseImage: (val: boolean) => void;
  heroImagePath: string;
  setHeroImagePath: (val: string) => void;
  useNotebookLM: boolean;
  setUseNotebookLM: (val: boolean) => void;
  notebookMode: "manual" | "auto";
  setNotebookMode: (val: "manual" | "auto") => void;
}

export const ManualTaskInput: React.FC<ManualTaskInputProps> = ({
  onAddTask,
  credentials,
  onChange,
  topic,
  setTopic,
  keywords,
  setKeywords,
  persona,
  setPersona,
  tone,
  setTone,
  useImage,
  setUseImage,
  heroImagePath,
  setHeroImagePath,
  useNotebookLM,
  setUseNotebookLM,
  notebookMode,
  setNotebookMode,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert("주제를 입력해주세요.");
      return;
    }

    const newTask: BatchTask = {
      topic: topic.trim(),
      keywords: keywords ? keywords.split(",").map((k) => k.trim()) : [],
      category: "동적 카테고리 (계정별)",
      persona,
      tone,
      useImage,
      heroImagePath: heroImagePath.trim(),
      useNotebookLM,
      notebookMode,
      naverCategory: credentials.naverCategory,
      naverCategory2: credentials.naverCategory2,
      status: "대기",
    };

    onAddTask(newTask);

    // 폼 초기화
    setTopic("");
    setKeywords("");
    setHeroImagePath("");
  };

  return (
    <div
      className="manual-input-container"
      style={{
        backgroundColor: "#fff",
        borderRadius: "12px",
        border: "1px solid #e9ecef",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
      }}
    >
      <TaskFormSection
        topic={topic}
        setTopic={setTopic}
        keywords={keywords}
        setKeywords={setKeywords}
        persona={persona}
        setPersona={setPersona}
        tone={tone}
        setTone={setTone}
        useImage={useImage}
        setUseImage={setUseImage}
        heroImagePath={heroImagePath}
        setHeroImagePath={setHeroImagePath}
        useNotebookLM={useNotebookLM}
        setUseNotebookLM={setUseNotebookLM}
        notebookMode={notebookMode}
        setNotebookMode={setNotebookMode}
        credentials={credentials}
        onChange={onChange}
        handleSubmit={handleSubmit}
      />
    </div>
  );
};
