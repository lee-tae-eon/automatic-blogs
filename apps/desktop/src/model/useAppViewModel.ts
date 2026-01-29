import { useState, useRef, useEffect, useCallback } from "react";
import { BatchTask, Persona } from "@blog-automation/core/types/blog";

export const useAppViewModel = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const shouldStopRef = useRef(false);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  const [credentials, setCredentials] = useState({
    naverId: "",
    naverPw: "",
    geminiKey: "",
    subGemini: "",
  });

  // 1. 초기 로드
  useEffect(() => {
    const loadCredentials = async () => {
      const storedCreds = await window.ipcRenderer.invoke(
        "get-store-data",
        "user-credentials",
      );
      if (storedCreds) {
        setCredentials((prev) => ({ ...prev, ...storedCreds }));
      }
      setIsStoreLoaded(true);
    };
    loadCredentials();
  }, []);

  // 2. 저장 로직
  useEffect(() => {
    if (isStoreLoaded) {
      window.ipcRenderer.send(
        "set-store-data",
        "user-credentials",
        credentials,
      );
    }
  }, [credentials, isStoreLoaded]);

  // 3. 핸들러들
  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const handlePersonaChange = (taskIndex: number, newPersona: Persona) => {
    setTasks((prevTasks) =>
      prevTasks.map((task, index) =>
        index === taskIndex ? { ...task, persona: newPersona } : task,
      ),
    );
  };

  const processFile = async (file: File) => {
    if (typeof window.ipcRenderer?.getFilePath !== "function") {
      alert("Electron 초기화 오류: 앱을 재시작해주세요.");
      return;
    }

    const filePath = window.ipcRenderer.getFilePath(file);
    if (!filePath) {
      alert("파일 경로를 찾을 수 없습니다.");
      return;
    }

    setCurrentFilePath(filePath);

    try {
      const result = await window.ipcRenderer.invoke("parse-excel", filePath);
      if (result.success) {
        setTasks(result.data);
      } else {
        alert(result.error || "파일 분석에 실패했습니다.");
      }
    } catch (error) {
      console.error("파일 처리 중 오류 발생:", error);
      alert("파일 처리 중 오류가 발생했습니다.");
    }
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    if (confirm("업로드된 목록을 모두 삭제하시겠습니까?")) {
      setTasks([]);
      setCurrentFilePath(null);
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
  };

  const handlePublishAll = async () => {
    if (isProcessing || tasks.length === 0) return;
    if (!confirm("모든 항목에 대해 블로그 발행을 시작하시겠습니까?")) return;

    setIsProcessing(true);
    shouldStopRef.current = false;

    const updateStatus = (index: number, status: BatchTask["status"]) => {
      setTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, status } : t)),
      );
    };

    for (const [i, task] of tasks.entries()) {
      if (shouldStopRef.current) {
        alert("작업이 사용자에 의해 중단되었습니다.");
        break;
      }

      if (task.status === "완료") continue;

      updateStatus(i, "진행");
      if (currentFilePath) {
        await window.ipcRenderer.invoke("update-task-status", {
          filePath: currentFilePath,
          index: i,
          status: "진행",
        });
      }

      try {
        // 생성
        const genResult = await window.ipcRenderer.invoke(
          "generate-post",
          task,
        );

        if (shouldStopRef.current) {
          updateStatus(i, "대기");
          break;
        }
        if (!genResult.success) throw new Error(genResult.error || "생성 실패");

        // 발행
        const pubResult = await window.ipcRenderer.invoke(
          "publish-post",
          genResult.data,
        );
        if (!pubResult.success) throw new Error(pubResult.error || "발행 실패");

        updateStatus(i, "완료");
        if (currentFilePath) {
          await window.ipcRenderer.invoke("update-task-status", {
            filePath: currentFilePath,
            index: i,
            status: "완료",
          });
        }
      } catch (error) {
        console.error(error);
        updateStatus(i, "실패");
        if (currentFilePath) {
          await window.ipcRenderer.invoke("update-task-status", {
            filePath: currentFilePath,
            index: i,
            status: "실패",
          });
        }
      }
    }

    if (shouldStopRef.current) {
      alert("작업이 중단되었습니다.");
    } else {
      alert("모든 작업이 종료되었습니다.");
    }
    setIsProcessing(false);
  };

  return {
    state: { tasks, isProcessing, credentials },
    actions: {
      handleCredentialChange,
      processFile,
      handleClearAll,
      handleStop,
      handlePublishAll,
      handlePersonaChange,
    },
  };
};
