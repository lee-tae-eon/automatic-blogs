import path from "path";
import fs from "fs";

export function findProjectRoot(startDir: string): string {
  let currentDir = startDir;
  try {
    while (currentDir !== path.parse(currentDir).root) {
      if (fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
  } catch (e) {
    // ignore
  }
  
  // Fallback for packaged apps or environments where workspace file is missing
  console.warn("⚠️ pnpm-workspace.yaml not found. Falling back to process.cwd()");
  return process.cwd();
}
