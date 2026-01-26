import { BatchTask } from "../types/blog";
import * as XLSX from "xlsx";

export class ExcelProcessor {
  /**
   * 엑셀 파일을 읽어 작업 목록으로 변환
   */
  static readTasks(filePath: string): BatchTask[] {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // 헤더 행 동적 탐색 (상위 10행 검사)
      // 엑셀 파일 상단에 제목이나 빈 줄이 있을 경우를 대비해 '주제' 또는 'Topic' 컬럼이 있는 행을 찾습니다.
      const rows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as any[][];
      let headerIndex = 0;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (row && row.some((c) => c === "Topic" || c === "주제")) {
          headerIndex = i;
          break;
        }
      }
      // 엑셀의 데이터를 JSON 형태로 변환 (찾은 헤더 위치부터 시작)
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        range: headerIndex,
      });

      return rawData.map((row: any) => ({
        topic: row["주제"] || row["Topic"],
        persona: row["페르소나"] || row["Persona"],
        tone: row["톤"] || row["Tone"],
        category: row["카테고리"] || row["Category"],
        platform: row["플랫폼"] || row["Platform"],
        keywords: row["키워드"] || row["Keywords"],
        status: row["상태"] || row["Status"] || "대기",
      }));
    } catch (error) {
      console.error("Excel Parsing Error:", error);
      throw Error("Excel Parsing Error");
    }
  }

  /**
   * 특정 작업의 상태를 엑셀 파일에 업데이트합니다.
   * @param filePath 엑셀 파일 경로
   * @param taskIndex 작업 인덱스 (0부터 시작)
   * @param status 변경할 상태 값
   */
  static updateTaskStatus(filePath: string, taskIndex: number, status: string) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 헤더(1행)에서 '상태' 또는 'Status' 컬럼 찾기
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      let statusColIndex = -1;

      // 헤더 행(row 0) 스캔
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
        const cell = worksheet[cellAddress];
        if (cell && (cell.v === "상태" || cell.v === "Status")) {
          statusColIndex = C;
          break;
        }
      }

      // '상태' 컬럼이 없으면 마지막 컬럼 다음에 추가
      if (statusColIndex === -1) {
        statusColIndex = range.e.c + 1;
        const headerAddress = XLSX.utils.encode_cell({
          r: 0,
          c: statusColIndex,
        });
        XLSX.utils.sheet_add_aoa(worksheet, [["상태"]], {
          origin: headerAddress,
        });
      }

      // 데이터 행 업데이트 (Header가 0행이므로 데이터는 taskIndex + 1 행)
      const targetRow = taskIndex + 1;
      const targetCell = XLSX.utils.encode_cell({
        r: targetRow,
        c: statusColIndex,
      });

      // 셀 값 업데이트
      XLSX.utils.sheet_add_aoa(worksheet, [[status]], { origin: targetCell });

      // 파일 저장
      XLSX.writeFile(workbook, filePath);
    } catch (error) {
      console.error("Excel Update Error:", error);
      throw new Error(
        "엑셀 파일 업데이트 실패 (파일이 열려있는지 확인해주세요)",
      );
    }
  }
}
