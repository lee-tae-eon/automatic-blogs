import * as XLSX from "xlsx";

export interface BatchTask {
  topic: string;
  persona: string;
  tone: string;
  category: string;
  status: "대기" | "진행중" | "완료" | "실패";
}

export class ExcelProcessor {
  /**
   * 엑셀 파일을 읽어 작업 목록으로 변환
   */
  static readTasks(filePath: string): BatchTask[] {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 엑셀의 데이터를 JSON 형태로 변환
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      return rawData.map((row: any) => ({
        topic: row["주제"] || row["Topic"],
        persona: row["페르소나"] || row["Persona"],
        tone: row["톤"] || row["Tone"],
        category: row["카테고리"] || row["Category"],
        status: "대기",
      }));
    } catch (error) {
      console.error("Excel Parsing Error:", error);
      throw Error("Excel Parsing Error");
    }
  }
}
