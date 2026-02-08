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
    tistoryId: "",
    tistoryPw: "",
    geminiKey: "",
    subGemini: "",
    headless: false,
    modelType: "normal" as "fast" | "normal",
    enableNaver: true,
    enableTistory: false,
  });

  // 1. 초기 로드
  useEffect(() => {
    const loadCredentials = async () => {
      const storedCreds = await window.ipcRenderer.invoke(
        "get-store-data",
        "user-credentials",
      );
      if (storedCreds) {
        setCredentials((prev) => ({
          ...prev,
          ...storedCreds,
          headless: storedCreds.headless ?? false,
          modelType: storedCreds.modelType ?? "normal",
          enableNaver: storedCreds.enableNaver ?? true,
          enableTistory: storedCreds.enableTistory ?? false,
          tistoryPw: storedCreds.tistoryPw || storedCreds.tistoryToken || "", // 마이그레이션 호환성
        }));
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
  const handleCredentialChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setCredentials((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddTask = (task: BatchTask) => {
    setTasks((prev) => [...prev, task]);
    addLog(`작업 추가됨: ${task.topic}`);
  };

  const updateTaskState = async (
    index: number,
    updates: { status?: BatchTask["status"]; persona?: Persona; tone?: Tone },
  ) => {
    // 1. 상태 먼저 업데이트 (메모리)
    setTasks((prevTasks) =>
      prevTasks.map((task, idx) => {
        if (idx === index) {
          return { ...task, ...updates };
        }
        return task;
      }),
    );

    // 2. 엑셀 파일이 있는 경우에만 파일 업데이트 수행
    if (currentFilePath) {
      const task = tasks[index];
      if (!task) return;

      try {
        const result = await window.ipcRenderer.invoke("update-task", {
          filePath: currentFilePath,
          index,
          status: updates.status || task.status,
          persona: updates.persona || task.persona,
          tone: updates.tone || task.tone,
        });

        if (!result.success) {
          console.error(`엑셀 저장 실패 (Row ${index + 1}):`, result.error);
        }
      } catch (e) {
        console.error("파일 업데이트 중 오류:", e);
      }
    }
  };

  const handlePersonaChange = async (
    taskIndex: number,
    newPersona: Persona,
  ) => {
    await updateTaskState(taskIndex, { persona: newPersona });
  };

  const handleToneChange = async (taskIndex: number, newTone: Tone) => {
    await updateTaskState(taskIndex, { tone: newTone });
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
        addLog(`[${i + 1}] 이미 완료된 항목입니다: ${task.topic}`);
        continue;
      }

      // 1. 진행 상태 반영
      addLog(`[${i + 1}] 콘텐츠 생성 중: ${task.topic}`);
      await updateTaskState(i, { status: "진행" });

      try {
        // 생성
        const genResult = await window.ipcRenderer.invoke("generate-post", {
          ...tasks[i],
          modelType: credentials.modelType, // 글로벌 설정값 적용
        });

        if (
          shouldStopRef.current ||
          abortControllerRef.current?.signal.aborted
        ) {
          addLog(`[${i + 1}] 중단됨: ${task.topic}`);
          await updateTaskState(i, { status: "대기" });
          break;
        }
        if (!genResult.success) throw new Error(genResult.error || "생성 실패");

        addLog(`[${i + 1}] 블로그 발행 중: ${task.topic}`);
        // 발행
        const publishTasks: Promise<any>[] = [];

        if (credentials.enableNaver) {
          publishTasks.push(
            window.ipcRenderer.invoke("publish-post", {
              ...genResult.data,
              platform: "naver",
              blogId: credentials.naverId,
              password: credentials.naverPw,
              headless: credentials.headless,
            }),
          );
        }

        if (credentials.enableTistory) {
          publishTasks.push(
            window.ipcRenderer.invoke("publish-post", {
              ...genResult.data,
              platform: "tistory",
              blogId: credentials.tistoryId,
              password: credentials.tistoryPw,
            }),
          );
        }

        if (publishTasks.length === 0) {
          throw new Error("발행할 플랫폼이 선택되지 않았습니다.");
        }

        const pubResults = await Promise.all(publishTasks);
        const failedPub = pubResults.find((r) => !r.success);
        if (failedPub) throw new Error(failedPub.error || "발행 실패");

        addLog(`[${i + 1}] 완료: ${task.topic}`);
        // 2. 완료 상태 반영
        await updateTaskState(i, { status: "완료" });
      } catch (error: any) {
        // 중단으로 인한 에러인 경우 무시
        if (error.name === "AbortError" || shouldStopRef.current) {
          addLog(`[${i + 1}] 작업이 중단되었습니다.`);
          break;
        }

        addLog(`[${i + 1}] 에러 발생: ${error.message || error}`);
        console.error(error);
        // 3. 실패 상태 반영
        await updateTaskState(i, { status: "실패" });
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
      handleAddTask, // 추가
      processFile,
      handleClearAll,
      handleStop,
      handlePublishAll,
      handlePersonaChange,
      handleToneChange,
    },
  };
};
