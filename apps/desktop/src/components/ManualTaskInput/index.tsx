import React, { useState } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";
import { TrendSection, TrendTopic, TrendCategory } from "./TrendSection";
import { TaskFormSection } from "./TaskFormSection";

interface ManualTaskInputProps {
  onAddTask: (task: BatchTask) => void;
  credentials: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ManualTaskInput: React.FC<ManualTaskInputProps> = ({
  onAddTask,
  credentials,
  onChange,
}) => {
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [persona, setPersona] = useState<Persona>("informative");
  const [tone, setTone] = useState<Tone>("empathetic");
  const [useImage, setUseImage] = useState(true); // v4.7: 이미지 사용 기본값 true
  const [heroImagePath, setHeroImagePath] = useState(""); // 🍌 [v8.8] 대표 이미지 경로 추가
  const [useNotebookLM, setUseNotebookLM] = useState(false); // v5.0: NotebookLM 사용 여부
  const [notebookMode, setNotebookMode] = useState<"manual" | "auto">("auto"); // v5.0: 검수 모드

  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [trendQuery, setTrendQuery] = useState("");
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [trendType, setTrendType] = useState<TrendCategory>(
    "hollywood",
  );

  const fetchTrends = async () => {
    setIsFetchingTrends(true);
    try {
      let channel = "";
      let arg: any = trendQuery;

      if (trendType === "hollywood") {
        channel = "fetch-hollywood-trends";
      } else if (trendType === "korea") {
        channel = "fetch-korea-trends";
      } else {
        // [v9.0] 일반 카테고리 추천 (tech, economy 등)
        channel = "fetch-recommended-topics";
        arg = trendType; // trendQuery 대신 카테고리 키 전달
      }

      const result = await window.ipcRenderer.invoke(channel, arg);
      if (result && result.success) {
        // fetch-recommended-topics의 경우 데이터 형식이 약간 다름 (keyword -> topic)
        if (trendType !== "hollywood" && trendType !== "korea") {
          const formatted = result.data.map((item: any) => ({
            topic: item.keyword,
            summary: item.reason,
            keywords: [item.keyword],
            persona: item.persona,
            tone: item.tone,
          }));
          setTrends(formatted);
        } else {
          setTrends(result.data);
        }
      } else {
        alert(
          "트렌드를 가져오지 못했습니다: " +
            (result?.error || "알 수 없는 오류"),
        );
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const selectTrend = (trend: TrendTopic) => {
    setTopic(trend.topic);
    setKeywords(trend.keywords.join(", "));

    // 추천된 페르소나와 톤이 있으면 우선 적용 (v9.0)
    if (trend.persona) {
      setPersona(trend.persona);
    } else {
      // 폴백 로직
      if (trendType === "hollywood") {
        setPersona("reporter");
      } else {
        setPersona("informative");
      }
    }

    if (trend.tone) {
      setTone(trend.tone);
    } else {
      setTone("empathetic");
    }
  };

  const clearTrends = () => {
    setTrends([]);
    setTrendQuery("");
  };

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
      heroImagePath: heroImagePath.trim(), // 🍌 [v8.8] 경로 추가
      useNotebookLM, // 추가
      notebookMode, // 추가
      naverCategory: credentials.naverCategory, // v5.4: 봇 실행 시점 값 스냅샷 저장
      naverCategory2: credentials.naverCategory2, // v5.4: 봇 실행 시점 값 스냅샷 저장
      status: "대기",
    };

    onAddTask(newTask);

    // 폼 초기화
    setTopic("");
    setKeywords("");
    setHeroImagePath("");
  };

  return (
    <>
      <style>
        {`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}
      </style>
      <div
        className="manual-input-container"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          backgroundColor: "#fff",
          borderRadius: "12px",
          border: "1px solid #e9ecef",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
            <TrendSection
              trendType={trendType}
              setTrendType={setTrendType}
              trends={trends}
              setTrends={setTrends}
              trendQuery={trendQuery}
              setTrendQuery={setTrendQuery}
              isFetchingTrends={isFetchingTrends}
              fetchTrends={fetchTrends}
              selectTrend={selectTrend}
              clearTrends={clearTrends}
              persona={persona}
              setPersona={setPersona}
            />
          </div>
        </div>
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
    </>
  );
};
