import React, { useState } from "react";
import "./App.scss";
import { Header } from "./components/Header";
import { useAppViewModel } from "./model/useAppViewModel";
import { ManualTaskInput } from "./components/ManualTaskInput";
import { ActionButtons } from "./components/ActionButtons";
import { TaskTable } from "./components/TaskTable";
import { LogConsole } from "./components/LogConsole";
import { CoupangTaskInput } from "./components/CoupangTaskInput"; 
import { TrendDiscovery } from "./components/TrendDiscovery"; // [v11.2] 신규 추가
import { HistoryTable } from "./components/HistoryTable"; // [v11.10] 신규 추가
import { TrendTopic, TrendCategory } from "./components/ManualTaskInput/TrendSection";
import { Persona, Tone } from "@blog-automation/core/types/blog";

export const App: React.FC = () => {
  const { state, actions } = useAppViewModel();
  const {
    tasks,
    isManualProcessing,
    credentials,
    logs,
  } = state;

  // [v11.10] 탭 상태 및 히스토리 데이터
  const [activeTab, setActiveTab] = React.useState<"tasks" | "history">("tasks");
  const [history, setHistory] = React.useState<any[]>([]);

  // [v11.2] 통합 상태 관리 (TrendDiscovery <-> ManualTaskInput)
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [persona, setPersona] = useState<Persona>("informative");
  const [tone, setTone] = useState<Tone>("empathetic");
  const [useImage, setUseImage] = useState(true);
  const [heroImagePath, setHeroImagePath] = useState("");
  const [useNotebookLM, setUseNotebookLM] = useState(false);
  const [notebookMode, setNotebookMode] = useState<"manual" | "auto">("auto");

  // 트렌드 데이터 상태 (v13.9 캐시 추가)
  const [trends, setTrends] = useState<TrendTopic[]>([]);
  const [trendCache, setTrendCache] = useState<Record<string, TrendTopic[]>>({}); 
  const [trendQuery, setTrendQuery] = useState("");
  const [isFetchingTrends, setIsFetchingTrends] = useState(false);
  const [trendType, setTrendType] = useState<TrendCategory>("korea");

  const fetchTrends = async (forceRefresh = false) => {
    if (isFetchingTrends) return;

    // 현재의 타입을 캡처 (상태 지연 및 경쟁 상태 방지)
    const currentType = trendType;
    const currentQuery = trendQuery;
    const cacheKey = `${currentType}_${currentQuery}`;

    // [v13.9] 캐시 확인 로직 (검색어가 없고 새로고침이 아닐 때)
    if (!forceRefresh && !currentQuery && trendCache[cacheKey]) {
      setTrends(trendCache[cacheKey]);
      return;
    }

    setIsFetchingTrends(true);
    // 새로운 데이터 수집 시작 시 기존 데이터 비우기 (혼선 방지)
    setTrends([]);

    try {
      let channel = "";
      let arg: any = null;

      if (currentType === "hollywood") {
        channel = "fetch-hollywood-trends";
        arg = currentQuery;
      } else if (currentType === "korea") {
        channel = "fetch-korea-trends";
        arg = currentQuery;
      } else if (currentType === "nate") {
        channel = "fetch-recommended-topics";
        arg = { category: "nate", query: currentQuery };
      } else {
        channel = "fetch-recommended-topics";
        arg = { category: currentType, query: currentQuery }; 
      }

      const result = await window.ipcRenderer.invoke(channel, arg);
      if (result && result.success) {
        let formatted: TrendTopic[] = [];
        if (currentType !== "hollywood" && currentType !== "korea" && currentType !== "nate") {
          formatted = result.data.map((item: any) => ({
            topic: item.keyword,
            summary: item.reason,
            keywords: [item.keyword],
            persona: item.persona,
            tone: item.tone,
            goldenScore: item.goldenScore,
            searchVolume: item.searchVolume,
            competitionIndex: item.competitionIndex
          }));
        } else {
          formatted = result.data.map((item: any) => ({
            topic: item.topic,
            summary: item.summary,
            keywords: item.keywords || [],
            persona: item.persona,
            tone: item.tone,
            goldenScore: item.goldenScore,
            searchVolume: item.searchVolume
          }));
        }
        
        // 여전히 해당 카테고리에 머물러 있을 때만 결과 반영 (선택 사항이지만 안전함)
        setTrends(formatted);
        setTrendCache(prev => ({ ...prev, [cacheKey]: formatted }));
      } else {
        alert("트렌드를 가져오지 못했습니다: " + (result?.error || "알 수 없는 오류"));
      }
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setIsFetchingTrends(false);
    }
  };

  const handleTrendCategoryChange = (type: TrendCategory) => {
    setTrendType(type);
    const cacheKey = `${type}_`; 
    if (trendCache[cacheKey]) {
      setTrends(trendCache[cacheKey]);
    } else {
      setTrends([]);
    }
    setTrendQuery("");
  };

  const selectTrend = (trend: TrendTopic) => {
    setTopic(trend.topic);
    setKeywords(""); // AI 자동 산출을 위해 비움

    if (trend.persona) {
      setPersona(trend.persona as Persona);
    } else {
      setPersona(trendType === "hollywood" ? "reporter" : "informative");
    }

    if (trend.tone) {
      setTone(trend.tone as Tone);
    } else {
      setTone("empathetic");
    }
    
    // 자동 스크롤: 주제 입력창으로 이동
    const element = document.querySelector(".manual-input-container");
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const clearTrends = () => {
    setTrends([]);
    setTrendQuery("");
  };

  const fetchHistory = async () => {
    try {
      const result = await window.ipcRenderer.invoke("fetch-history", { limit: 50 });
      if (result.success) {
        setHistory(result.data);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  };

  React.useEffect(() => {
    if (activeTab === "history") {
      fetchHistory();
    }
  }, [activeTab]);

  return (
    <div
      className="container"
      style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}
    >
      <Header
        credentials={credentials}
        onChange={actions.handleCredentialChange}
      />

      {/* v11.10 탭 내비게이션 */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid #eee", paddingBottom: "10px" }}>
        <button
          onClick={() => setActiveTab("tasks")}
          style={{
            padding: "8px 20px",
            backgroundColor: activeTab === "tasks" ? "#007aff" : "#f1f3f5",
            color: activeTab === "tasks" ? "white" : "#495057",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          🚀 작업 대기열
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "8px 20px",
            backgroundColor: activeTab === "history" ? "#007aff" : "#f1f3f5",
            color: activeTab === "history" ? "white" : "#495057",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          📋 발행 히스토리
        </button>
      </div>

      {activeTab === "tasks" ? (
        <>
          {/* v11.2 통합 트렌드 탐색 영역 (기존 AutoPilot 대체) */}
          <TrendDiscovery
            trendType={trendType}
            setTrendType={handleTrendCategoryChange}
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

          {/* 쿠팡 파트너스 전용 입력 패널 */}
          <CoupangTaskInput
            onAddTask={actions.handleAddTask}
            credentials={credentials}
            onChange={actions.handleCredentialChange}
          />

          {/* 메인 입력 영역 (트렌드 섹션 제거됨) */}
          <ManualTaskInput
            onAddTask={actions.handleAddTask}
            credentials={credentials}
            onChange={actions.handleCredentialChange}
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
          />

          {/* 제어 영역: 엑셀 업로드 및 실행 버튼 */}
          <ActionButtons
            hasTasks={tasks.length > 0}
            isProcessing={isManualProcessing}
            logs={logs}
            onClear={actions.handleClearAll}
            onStop={actions.handleStop}
            onPublish={actions.handlePublishAll}
            onFileUpload={actions.processFile}
          />

          {/* 작업 목록 영역 */}
          <TaskTable
            tasks={tasks}
            onPersonaChange={actions.handlePersonaChange}
            onToneChnage={actions.handleToneChange}
            onUseImageChange={actions.handleUseImageChange}
            onApprove={actions.handleApproveTask}
          />
        </>
      ) : (
        <HistoryTable history={history} onRefresh={fetchHistory} />
      )}

      <LogConsole logs={logs} />
    </div>
  );
};
