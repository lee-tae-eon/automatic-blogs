import { app, BrowserWindow, ipcMain } from "electron";
import * as path from "path";
// @blog-automation/core에서 필요한 클래스 임포트
import { ExcelProcessor } from "@blog-automation/core";

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

// 엑셀 파싱 IPC 핸들러
ipcMain.handle("parse-excel", async (_, filePath: string) => {
  try {
    // core 패키지의 ExcelProcessor 활용
    return ExcelProcessor.readTasks(filePath);
  } catch (error) {
    console.error("Excel Parsing Error:", error);
    throw error;
  }
});
