import React from "react";
import "./App.scss";
import { Header } from "./components/Header";
import { useAppViewModel } from "./model/useAppViewModel";
import { ManualTaskInput } from "./components/ManualTaskInput";
import { ActionButtons } from "./components/ActionButtons";
import { TaskTable } from "./components/TaskTable";
import { LogConsole } from "./components/LogConsole";
import { AutoPilotControl } from "./components/AutoPilotControl"; // 추가

export const App: React.FC = () => {
  const { state, actions } = useAppViewModel();
  const { tasks, isManualProcessing, isAutoSearching, isAutoPublishing, credentials, logs } = state;

  return (
    <div className="container" style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
      <Header
        credentials={credentials}
        onChange={actions.handleCredentialChange}
      />

      {/* v2.0 Auto-Pilot 영역 */}
      <AutoPilotControl 
        isSearching={isAutoSearching}
        isPublishing={isAutoPublishing}
        candidates={state.candidates}
        onFetch={actions.handleFetchCandidates}
        onStop={actions.handleStopAutoPilot}
        onStart={actions.handleStartWithKeyword} 
      />

      {/* 메인 입력 영역: 2단 레이아웃 (트렌드 + 폼) */}
      <ManualTaskInput onAddTask={actions.handleAddTask} />

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
      />

      <LogConsole logs={logs} />
    </div>
  );
};
