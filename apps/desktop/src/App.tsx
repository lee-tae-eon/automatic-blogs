import React from "react";
import "./App.scss";
import { Header } from "./components/Header";
import { useAppViewModel } from "./model/useAppViewModel";
import { FileUploader } from "./components/FileUploader";
import { ActionButtons } from "./components/ActionButtons";
import { TaskTable } from "./components/TaskTable";

export const App: React.FC = () => {
  const { state, actions } = useAppViewModel();
  const { tasks, isProcessing, credentials } = state;

  return (
    <div className="container">
      <Header
        credentials={credentials}
        onChange={actions.handleCredentialChange}
      />

      <FileUploader onFileSelect={actions.processFile} />

      <ActionButtons
        hasTasks={tasks.length > 0}
        isProcessing={isProcessing}
        onClear={actions.handleClearAll}
        onStop={actions.handleStop}
        onPublish={actions.handlePublishAll}
      />

      <TaskTable
        tasks={tasks}
        onPersonaChange={actions.handlePersonaChange}
      />
    </div>
  );
};
