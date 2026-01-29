import { BatchTask, Persona } from "../types/blog";
import * as XLSX from "xlsx";

export class ExcelProcessor {
  /**
   * 헤더 행의 위치와 특정 컬럼의 인덱스를 동적으로 탐색합니다.
   */
  private static findHeaderInfo(worksheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    let headerRowIndex = -1;
    let statusColIndex = -1;

    // 상위 10행을 검사하여 헤더 행 탐색
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (row && row.some((c) => c === "Topic" || c === "주제")) {
        headerRowIndex = i;
        // 해당 행에서 Status/상태 컬럼 위치 파악
        statusColIndex = row.findIndex((c) => c === "Status" || c === "상태");
        break;
      }
    }

    return { headerRowIndex, statusColIndex };
  }

  static readTasks(filePath: string): BatchTask[] {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const { headerRowIndex } = this.findHeaderInfo(worksheet);
      if (headerRowIndex === -1) throw new Error("헤더를 찾을 수 없습니다.");

      // 찾은 헤더 위치부터 데이터 읽기
      const rawData = XLSX.utils.sheet_to_json(worksheet, {
        range: headerRowIndex,
      });

      return rawData.map((row: any) => {
        const persona = row["페르소나"] || row["Persona"];
        return {
          topic: row["주제"] || row["Topic"],
          persona:
            persona === "informative"
              ? "experiential"
              : (persona as Persona),
          tone: row["톤"] || row["Tone"],
          category: row["카테고리"] || row["Category"],
          platform: row["플랫폼"] || row["Platform"],
          keywords: row["키워드"] || row["Keywords"],
          status: row["상태"] || row["Status"] || "대기",
        };
      });
    } catch (error) {
      console.error("Excel Parsing Error:", error);
      throw Error("Excel Parsing Error");
    }
  }

  static updateTaskStatus(filePath: string, taskIndex: number, status: string) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // 1. 헤더 행 위치와 Status 컬럼 인덱스 동적 탐색
      const { headerRowIndex, statusColIndex } = this.findHeaderInfo(worksheet);

      if (headerRowIndex === -1) {
        throw new Error("엑셀에서 헤더(Topic/주제)를 찾을 수 없습니다.");
      }

      // 2. Status 컬럼이 없는 경우에만 마지막에 추가 (기존 Status 열이 있으면 활용)
      let finalColIndex = statusColIndex;
      if (finalColIndex === -1) {
        const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
        finalColIndex = range.e.c + 1;
        // 헤더 행에 'Status' 추가
        XLSX.utils.sheet_add_aoa(worksheet, [["Status"]], {
          origin: XLSX.utils.encode_cell({
            r: headerRowIndex,
            c: finalColIndex,
          }),
        });
      }

      // 3. 데이터 행 업데이트
      // 실제 데이터는 headerRowIndex 바로 다음행부터 시작하므로 인덱스 합산
      const targetRow = headerRowIndex + 1 + taskIndex;
      const targetCell = XLSX.utils.encode_cell({
        r: targetRow,
        c: finalColIndex,
      });

      // 셀 값 업데이트 (기존 양식 유지하며 값만 덮어쓰기)
      XLSX.utils.sheet_add_aoa(worksheet, [[status]], { origin: targetCell });

      // 4. 파일 저장
      XLSX.writeFile(workbook, filePath);
      console.log(
        `✅ 엑셀 업데이트 완료: ${targetRow + 1}행 Status -> ${status}`,
      );
    } catch (error) {
      console.error("Excel Update Error:", error);
      throw new Error("엑셀 파일 업데이트 실패 (파일 열림 여부 확인)");
    }
  }
}
