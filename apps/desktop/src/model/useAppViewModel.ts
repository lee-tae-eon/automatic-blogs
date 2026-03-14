import { useState, useRef, useEffect } from "react";
import { BatchTask, Persona, Tone } from "@blog-automation/core/types/blog";

export const useAppViewModel = () => {
  const [tasks, setTasks] = useState<BatchTask[]>([]);

  // 상태 세분화 (v3.23)
  const [isManualProcessing, setIsManualProcessing] = useState(false);
  const [isAutoSearching, setIsAutoSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Record<string, any[]>>(
    {},
  ); // 추가
  const [isFetchingRecs, setIsFetchingRecs] = useState(false); // 추가

  const shouldStopManualRef = useRef(false);
  const manualAbortControllerRef = useRef<AbortController | null>(null);

  const shouldStopAutoRef = useRef(false);
  const autoAbortControllerRef = useRef<AbortController | null>(null);

  const [isStoreLoaded, setIsStoreLoaded] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 99)]);
  };

  const [credentials, setCredentials] = useState({
    naverId: "",
    naverPw: "",
    naverCategory: "",
    naverId2: "",
    naverPw2: "",
    naverCategory2: "",
    tistoryId: "",
    tistoryPw: "",
    geminiKey: "",
    subGemini: "",
    thirdGemini: "",
    headless: false,
    modelType: "normal" as "fast" | "normal",
    enableNaver: true,
    enableNaver2: false,
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
          enableNaver2: storedCreds.enableNaver2 ?? false,
          enableTistory: storedCreds.enableTistory ?? false,
          thirdGemini: storedCreds.thirdGemini || "",
          tistoryPw: storedCreds.tistoryPw || storedCreds.tistoryToken || "", // 마이그레이션 호환성
          naverCategory: storedCreds.naverCategory || "일상정보",
          naverId2: storedCreds.naverId2 || "",
          naverPw2: storedCreds.naverPw2 || "",
          naverCategory2: storedCreds.naverCategory2 || "일상정보",
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
    updates: {
      status?: BatchTask["status"];
      persona?: Persona;
      tone?: Tone;
      useImage?: boolean;
    },
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

  const handleUseImageChange = async (taskIndex: number, useImage: boolean) => {
    await updateTaskState(taskIndex, { useImage });
  };

  const handleApproveTask = async (index: number) => {
    // 1. 검수 완료 상태로 변경
    setTasks((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, isReviewed: true, status: "진행" } : t,
      ),
    );
    addLog(`✅ 검수 완료 승인: ${tasks[index].topic}. 곧 발행을 시작합니다.`);

    // 2. 발행 프로세스 재실행 (이미 'isReviewed: true'이므로 검수 단계를 건너뛰고 발행함)
    // handlePublishAll을 호출하면 '진행' 상태인 것부터 순차적으로 다시 처리함
    setTimeout(() => {
      handlePublishAll(true); // 자동 승인 모드로 재실행
    }, 500);
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
            tone: task.tone || "공감형",
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
    if (isManualProcessing) return;
    if (confirm("업로드된 목록을 모두 삭제하시겠습니까?")) {
      setTasks([]);
      setCurrentFilePath(null);
      setLogs([]);
      addLog("목록이 초기화되었습니다.");
    }
  };

  const handleStop = () => {
    shouldStopManualRef.current = true;
    if (manualAbortControllerRef.current) {
      manualAbortControllerRef.current.abort();
    }
    window.ipcRenderer.send("abort-process", "manual"); // 'manual' 인자 추가
    addLog(
      "중단 요청을 보냈습니다. 현재 수동 작업이 마무리되는 대로 중단됩니다.",
    );
  };

  /**
   * v3.0 추천 토픽 가져오기 핸들러
   */
  const handleFetchRecommendations = async (category: string) => {
    setIsFetchingRecs(true);
    addLog(`📡 [추천 시스템] '${category}' 카테고리 최신 트렌드 분석 시작...`);
    try {
      const result = await window.ipcRenderer.invoke(
        "fetch-recommended-topics",
        category,
      );
      if (result.success) {
        setRecommendations((prev) => ({ ...prev, [category]: result.data }));
      } else {
        addLog(`❌ 추천 토픽 수집 실패: ${result.error}`);
      }
    } catch (e: any) {
      addLog(`❌ 추천 토픽 오류: ${e.message}`);
    } finally {
      setIsFetchingRecs(false);
    }
  };

  // (Legacy AutoPilot functions removed)

  /**
   * v2.0 오토파일럿 중단 핸들러
   */
  const handleStopAutoPilot = () => {
    shouldStopAutoRef.current = true;
    if (autoAbortControllerRef.current) {
      autoAbortControllerRef.current.abort();
    }
    window.ipcRenderer.send("abort-process", "auto"); // 'auto' 인자 추가
    addLog("🛑 [Auto-Pilot] 중단 요청을 보냈습니다.");
  };

  /**
   * v2.0 오토파일럿 1단계: 키워드 후보 분석
   */
  const handleFetchCandidates = async (broadTopic: string) => {
    if (isAutoSearching || !broadTopic.trim()) return;

    setIsAutoSearching(true);
    shouldStopAutoRef.current = false;
    autoAbortControllerRef.current = new AbortController();
    setCandidates([]);
    addLog(`🔍 [Auto-Pilot] 주제 '${broadTopic}' 분석 중...`);

    try {
      const result = await window.ipcRenderer.invoke(
        "fetch-keyword-candidates",
        {
          broadTopic,
          modelType: credentials.modelType,
        },
      );

      if (result.success) {
        setCandidates(result.data);
        addLog(
          `✅ [Auto-Pilot] ${result.data.length}개의 키워드 후보를 찾았습니다.`,
        );
      } else {
        if (result.error === "AbortError") {
          addLog("🛑 [Auto-Pilot] 분석이 중단되었습니다.");
        } else {
          addLog(`❌ [Auto-Pilot] 분석 실패: ${result.error}`);
        }
      }
    } catch (error: any) {
      addLog(`❌ [Auto-Pilot] 오류: ${error.message}`);
    } finally {
      setIsAutoSearching(false);
      autoAbortControllerRef.current = null;
    }
  };

  // handleStartWithKeyword removed

  const handlePublishAll = async (isResume = false) => {
    if (isManualProcessing || tasks.length === 0) return;
    if (
      !isResume &&
      !confirm("모든 항목에 대해 블로그 발행을 시작하시겠습니까?")
    )
      return;

    setIsManualProcessing(true);
    shouldStopManualRef.current = false;
    manualAbortControllerRef.current = new AbortController();
    setLogs([]); // 초기화
    addLog("전체 발행 프로세스를 시작합니다.");

    for (const [i, task] of tasks.entries()) {
      if (
        shouldStopManualRef.current ||
        manualAbortControllerRef.current?.signal.aborted
      ) {
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
          modelType: credentials.modelType,
        });

        if (
          shouldStopManualRef.current ||
          manualAbortControllerRef.current?.signal.aborted
        ) {
          addLog(`[${i + 1}] 중단됨: ${task.topic}`);
          await updateTaskState(i, { status: "대기" });
          break;
        }
        if (!genResult.success) throw new Error(genResult.error || "생성 실패");

        // [v5.0] NotebookLM 검수 로직: 사용자가 '직접 검수'를 선택했고 아직 검수 전이라면 여기서 멈춤
        if (
          task.useNotebookLM &&
          task.notebookMode === "manual" &&
          !task.isReviewed
        ) {
          addLog(`[${i + 1}] NotebookLM 사용자 검수 대기 중: ${task.topic}`);
          await updateTaskState(i, { status: "검수중" });
          setIsManualProcessing(false);
          return;
        }

        addLog(`[${i + 1}] 블로그 발행 중: ${task.topic}`);
        // 발행 - 순차 실행 (Sequential Execution)
        const platformsToPublish = [];

        if (credentials.enableNaver && credentials.naverId && (!task.targetAccount || task.targetAccount === "naver1")) {
          platformsToPublish.push({
            ...genResult.data,
            platform: "naver",
            blogId: credentials.naverId,
            password: credentials.naverPw,
            category: task.naverCategory || credentials.naverCategory, // 스냅샷 우선 적용 (없으면 폴백)
            headless: credentials.headless,
          });
        }

        if (credentials.enableNaver2 && credentials.naverId2 && (!task.targetAccount || task.targetAccount === "naver2")) {
          platformsToPublish.push({
            ...genResult.data,
            platform: "naver",
            blogId: credentials.naverId2,
            password: credentials.naverPw2,
            category: task.naverCategory2 || credentials.naverCategory2, // 스냅샷 우선 적용 (없으면 폴백)
            headless: credentials.headless,
          });
        }

        if (credentials.enableTistory && credentials.tistoryId) {
          platformsToPublish.push({
            ...genResult.data,
            platform: "tistory",
            blogId: credentials.tistoryId,
            password: credentials.tistoryPw,
            headless: credentials.headless,
          });
        }

        if (platformsToPublish.length === 0) {
          throw new Error("발행할 플랫폼이 선택되지 않았습니다.");
        }

        for (const publishConfig of platformsToPublish) {
          const pubResult = await window.ipcRenderer.invoke(
            "publish-post",
            publishConfig,
          );
          if (!pubResult.success) {
            throw new Error(
              pubResult.error || `${publishConfig.platform} 발행 실패`,
            );
          }
        }

        addLog(`[${i + 1}] 완료: ${task.topic}`);
        // 2. 완료 상태 반영
        await updateTaskState(i, { status: "완료" });
      } catch (error: any) {
        // 중단으로 인한 에러인 경우 무시
        if (error.name === "AbortError" || shouldStopManualRef.current) {
          addLog(`[${i + 1}] 작업이 중단되었습니다.`);
          break;
        }

        addLog(`[${i + 1}] 에러 발생: ${error.message || error}`);
        console.error(error);
        // 3. 실패 상태 반영
        await updateTaskState(i, { status: "실패" });
      }
    }

    if (shouldStopManualRef.current) {
      addLog("작업이 중단되었습니다.");
    } else {
      addLog("모든 작업이 종료되었습니다.");
      alert("모든 작업이 종료되었습니다.");
    }
    setIsManualProcessing(false);
    manualAbortControllerRef.current = null;
  };

  return {
    state: {
      tasks,
      isManualProcessing,
      isAutoSearching,
      isProcessing: isManualProcessing || isAutoSearching, // 하위 호환성 유지
      credentials,
      logs,
      candidates,
      recommendations,
      isFetchingRecs,
    },
    actions: {
      handleCredentialChange,
      handleAddTask, // 추가
      processFile,
      handleClearAll,
      handleStop,
      handlePublishAll,
      handlePersonaChange,
      handleToneChange,
      handleUseImageChange,
      handleFetchCandidates,
      handleStopAutoPilot, // 추가
      handleFetchRecommendations, // 추가
      handleApproveTask, // 추가
    },
  };
};
