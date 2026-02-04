import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ⚠️ 주의: packages/core/package.json의 "name" 필드와 정확히 일치해야 합니다.
// 예: "@blog-automation/core" 또는 "@blog/core" 중 하나만 쓰셔도 됩니다.
const CORE_PACKAGE_NAME = "@blog-automation/core";

export default defineConfig({
  plugins: [react()],

  // 1. Electron 빌드 필수 설정 (상대 경로)
  base: "./",

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // (선택사항) 만약 tsc build 없이 소스를 직접 보고 싶다면 아래 주석 해제
    // [CORE_PACKAGE_NAME]: path.resolve(__dirname, "../../packages/core/src/index.ts")
  },

  build: {
    outDir: "dist",
    // 2. 디버깅용: 프로덕션 빌드에서도 에러 위치를 정확히 추적하기 위해 켜는 것을 추천
    sourcemap: true,
  },

  // 3. 의존성 최적화 예외 처리
  optimizeDeps: {
    // Vite가 이 패키지를 '외부 라이브러리'로 캐싱하지 않도록 강제합니다.
    // 소스 코드가 바뀔 때마다 다시 컴파일하도록 합니다.
    exclude: [CORE_PACKAGE_NAME],
  },

  // 4. 🔥 핵심 추가: 파일 감시(Watch) 강제 설정
  server: {
    watch: {
      // 기본적으로 Vite는 node_modules 내부를 감시하지 않습니다.
      // 하지만 우리 core 패키지는 node_modules 안에 링크되어 있으므로,
      // '!' (Not) 연산자를 사용해 "이 폴더만큼은 무시하지 말고 감시해라"라고 설정해야 합니다.
      ignored: [`!**/node_modules/${CORE_PACKAGE_NAME}/**`],
    },
  },
});
