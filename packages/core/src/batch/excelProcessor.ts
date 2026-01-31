import { BatchTask, Persona, Tone } from "../types/blog";
import * as XLSX from "xlsx";

export class ExcelProcessor {
  /**
   * 헤더 행의 위치와 특정 컬럼의 인덱스를 동적으로 탐색합니다.
   */
  private static findHeaderInfo(worksheet: XLSX.WorkSheet) {
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    let headerRowIndex = -1;
    let statusColIndex = -1;
    let personaColIndex = -1;

    // 상위 10행을 검사하여 헤더 행 탐색
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (row && row.some((c) => c === "Topic" || c === "주제")) {
        headerRowIndex = i;
        // 해당 행에서 Status/상태 컬럼 위치 파악
        statusColIndex = row.findIndex((c) => c === "Status" || c === "상태");
        // 해당 행에서 Persona/페르소나 컬럼 위치 파악
        personaColIndex = row.findIndex(
          (c) => c === "Persona" || c === "페르소나",
        );
        break;
      }
    }

    return { headerRowIndex, statusColIndex, personaColIndex };
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
        return {
          topic: row["주제"] || row["Topic"],
          persona: row["Persona"], // 앱에서 설정하도록 기본값 부여
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

  static updateTaskInExcel(
    filePath: string,
    taskIndex: number,
    {
      status,
      persona,
      tone,
    }: { status: BatchTask["status"]; persona: Persona; tone: Tone },
  ) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const { headerRowIndex, statusColIndex, personaColIndex } =
        this.findHeaderInfo(worksheet);

      if (headerRowIndex === -1) {
        throw new Error("엑셀에서 헤더(Topic/주제)를 찾을 수 없습니다.");
      }

      const updateColumn = (
        colIndex: number,
        colName: string,
        value: string,
      ) => {
        let finalColIndex = colIndex;
        if (finalColIndex === -1) {
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
          finalColIndex = range.e.c + 1;
          XLSX.utils.sheet_add_aoa(worksheet, [[colName]], {
            origin: XLSX.utils.encode_cell({
              r: headerRowIndex,
              c: finalColIndex,
            }),
          });
        }
        const targetRow = headerRowIndex + 1 + taskIndex;
        const targetCell = XLSX.utils.encode_cell({
          r: targetRow,
          c: finalColIndex,
        });
        XLSX.utils.sheet_add_aoa(worksheet, [[value]], { origin: targetCell });
      };

      if (status) {
        updateColumn(statusColIndex, "Status", status);
      }
      if (persona) {
        updateColumn(personaColIndex, "Persona", persona);
      }

      XLSX.writeFile(workbook, filePath);
      console.log(
        `✅ 엑셀 업데이트 완료: ${
          taskIndex + headerRowIndex + 2
        }행 Status -> ${status}, Persona -> ${persona}, Tone -> ${tone}`,
      );
    } catch (error) {
      console.error("Excel Update Error:", error);
      throw new Error("엑셀 파일 업데이트 실패 (파일 열림 여부 확인)");
    }
  }
}
