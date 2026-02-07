import React from "react";
import "./App.scss";
import { Header } from "./components/Header";
import { useAppViewModel } from "./model/useAppViewModel";
import { FileUploader } from "./components/FileUploader";
import { ManualTaskInput } from "./components/ManualTaskInput"; // 추가
import { ActionButtons } from "./components/ActionButtons";
import { TaskTable } from "./components/TaskTable";
import { LogConsole } from "./components/LogConsole";

export const App: React.FC = () => {
  const { state, actions } = useAppViewModel();
  const { tasks, isProcessing, credentials, logs } = state;

  return (
    <div className="container">
      <Header
        credentials={credentials}
        onChange={actions.handleCredentialChange}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <FileUploader onFileSelect={actions.processFile} />
        <ManualTaskInput onAddTask={actions.handleAddTask} />
      </div>

      <ActionButtons
        hasTasks={tasks.length > 0}
        isProcessing={isProcessing}
        logs={logs}
        onClear={actions.handleClearAll}
        onStop={actions.handleStop}
        onPublish={actions.handlePublishAll}
      />

      <TaskTable
        tasks={tasks}
        onPersonaChange={actions.handlePersonaChange}
        onToneChnage={actions.handleToneChange}
      />

      <LogConsole logs={logs} />
    </div>
  );
};
