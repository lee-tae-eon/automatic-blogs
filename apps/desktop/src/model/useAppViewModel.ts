import { useState, useRef, useEffect } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

export const useAppViewModel = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const shouldStopRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

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

  // 3. 프로세스 로그 리스너
  useEffect(() => {
    const handleProcessLog = (message: string) => {
      addLog(message);
    };

    window.ipcRenderer.on("process-log", handleProcessLog);
    return () => {
      // removeListener가 contextBridge에 구현되어 있음
      window.ipcRenderer.removeListener("process-log", handleProcessLog);
    };
  }, []);

  // 4. 핸들러들
  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({ ...prev, [name]: value }));
  };

  const updateTaskInExcel = async (
    index: number,
    updates: { status?: BatchTask["status"]; persona?: Persona; tone?: Tone },
  ) => {
    if (!currentFilePath) return;

    const task = tasks[index];
    if (!task) return;

    const result = await window.ipcRenderer.invoke("update-task", {
      filePath: currentFilePath,
      index,
      status: updates.status || task.status,
      persona: updates.persona || task.persona,
      tone: updates.tone || task.tone,
    });

    if (!result.success) {
      console.error(`엑셀 저장 실패 (Row ${index + 1}):`, result.error);
      // 에러가 발생해도 전체 프로세스를 멈출지 여부는 선택이지만,
      // 저장이 안 되는 건 치명적이므로 사용자에게 알림.
      // 연속으로 뜨는 것을 방지하기 위해 콘솔만 찍고, 상위에서 처리하도록 throw 할 수도 있음.
      // 여기서는 일단 에러를 throw하여 handlePublishAll의 catch 블록으로 이동하게 함.
      throw new Error(`엑셀 저장 실패: ${result.error}`);
    }
  };

  const handlePersonaChange = async (
    taskIndex: number,
    newPersona: Persona,
  ) => {
    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index === taskIndex) {
          const updatedTask = { ...task, persona: newPersona };
          updateTaskInExcel(taskIndex, { persona: newPersona });
          return updatedTask;
        }
        return task;
      }),
    );
  };

  const handleToneChange = async (taskIndex: number, newTone: Tone) => {
    setTasks((prevTasks) =>
      prevTasks.map((task, index) => {
        if (index === taskIndex) {
          const updatedTask = { ...task, tone: newTone };
          updateTaskInExcel(taskIndex, { tone: newTone });
          return updatedTask;
        }
        return task;
      }),
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
    addLog(`파일 로드 시도: ${file.name}`);

    try {
      const result = await window.ipcRenderer.invoke("parse-excel", filePath);
      if (result.success) {
        addLog(`파일 로드 성공: ${result.data.length}개의 항목`);
        setTasks(
          result.data.map((task: BatchTask) => ({
            ...task,
            persona: task.persona || "정보형",
            tone: task.tone || "전문적인",
          })),
        );
      } else {
        addLog(`파일 분석 실패: ${result.error}`);
        alert(result.error || "파일 분석에 실패했습니다.");
      }
    } catch (error) {
      addLog(`파일 처리 중 오류 발생`);
      console.error("파일 처리 중 오류 발생:", error);
      alert("파일 처리 중 오류가 발생했습니다.");
    }
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    if (confirm("업로드된 목록을 모두 삭제하시겠습니까?")) {
      setTasks([]);
      setCurrentFilePath(null);
      setLogs([]);
      addLog("목록이 초기화되었습니다.");
    }
  };

  const handleStop = () => {
    shouldStopRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    window.ipcRenderer.send("abort-process");
    addLog("중단 요청을 보냈습니다. 현재 작업이 마무리되는 대로 중단됩니다.");
  };

  const handlePublishAll = async () => {
    if (isProcessing || tasks.length === 0) return;
    if (!confirm("모든 항목에 대해 블로그 발행을 시작하시겠습니까?")) return;

    setIsProcessing(true);
    shouldStopRef.current = false;
    abortControllerRef.current = new AbortController();
    setLogs([]); // 초기화
    addLog("전체 발행 프로세스를 시작합니다.");

    for (const [i, task] of tasks.entries()) {
      if (shouldStopRef.current || abortControllerRef.current?.signal.aborted) {
        addLog("사용자에 의해 작업이 중단되었습니다.");
        break;
      }

      if (task.status === "완료") {
        addLog(`[${i + 1}] 이미 완료된 항목입니다: ${task.keyword}`);
        continue;
      }

      // 1. 진행 상태 반영
      addLog(`[${i + 1}] 콘텐츠 생성 중: ${task.keyword}`);
      setTasks((prev) =>
        prev.map((t, idx) => (idx === i ? { ...t, status: "진행" } : t)),
      );
      await updateTaskInExcel(i, { status: "진행" });

      try {
        // 생성
        const genResult = await window.ipcRenderer.invoke(
          "generate-post",
          tasks[i],
        );

        if (shouldStopRef.current || abortControllerRef.current?.signal.aborted) {
          addLog(`[${i + 1}] 중단됨: ${task.keyword}`);
          setTasks((prev) =>
            prev.map((t, idx) => (idx === i ? { ...t, status: "대기" } : t)),
          );
          await updateTaskInExcel(i, { status: "대기" });
          break;
        }
        if (!genResult.success) throw new Error(genResult.error || "생성 실패");

        addLog(`[${i + 1}] 블로그 발행 중: ${task.keyword}`);
        // 발행
        const pubResult = await window.ipcRenderer.invoke(
          "publish-post",
          genResult.data,
        );
        if (!pubResult.success) throw new Error(pubResult.error || "발행 실패");

        addLog(`[${i + 1}] 완료: ${task.keyword}`);
        // 2. 완료 상태 반영
        setTasks((prev) =>
          prev.map((t, idx) => (idx === i ? { ...t, status: "완료" } : t)),
        );
        await updateTaskInExcel(i, { status: "완료" });
      } catch (error: any) {
        // 중단으로 인한 에러인 경우 무시
        if (error.name === "AbortError" || shouldStopRef.current) {
          addLog(`[${i + 1}] 작업이 중단되었습니다.`);
          break;
        }

        addLog(`[${i + 1}] 에러 발생: ${error.message || error}`);
        console.error(error);
        // 3. 실패 상태 반영
        setTasks((prev) =>
          prev.map((t, idx) => (idx === i ? { ...t, status: "실패" } : t)),
        );
        await updateTaskInExcel(i, { status: "실패" });
      }
    }

    if (shouldStopRef.current) {
      addLog("작업이 중단되었습니다.");
    } else {
      addLog("모든 작업이 종료되었습니다.");
      alert("모든 작업이 종료되었습니다.");
    }
    setIsProcessing(false);
    abortControllerRef.current = null;
  };

  return {
    state: { tasks, isProcessing, credentials, logs },
    actions: {
      handleCredentialChange,
      processFile,
      handleClearAll,
      handleStop,
      handlePublishAll,
      handlePersonaChange,
      handleToneChange,
    },
  };
};
