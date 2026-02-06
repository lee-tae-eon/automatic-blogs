import { BatchTask, Persona, Tone } from "../types/blog";
import * as XLSX from "xlsx";

export class ExcelProcessor {
  /**
   * 엑셀 시트에서 헤더 정보를 찾아 각 컬럼의 인덱스를 반환합니다.
   */
  private static findHeaderInfo(worksheet: XLSX.WorkSheet) {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

    // 1. 헤더 행 찾기 (보통 첫 번째 행이지만, 'Topic'이 있는 행을 찾음)
    let headerRowIndex = -1;
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v === "Topic") {
          // 'Topic'을 기준점으로 삼음
          headerRowIndex = R;
          break;
        }
      }
      if (headerRowIndex !== -1) break;
    }

    if (headerRowIndex === -1) {
      return {
        headerRowIndex: -1,
        statusColIndex: -1,
        personaColIndex: -1,
        toneColIndex: -1,
      };
    }

    // 2. 해당 행에서 각 컬럼의 인덱스 찾기
    let statusColIndex = -1;
    let personaColIndex = -1;
    let toneColIndex = -1;

    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell =
        worksheet[XLSX.utils.encode_cell({ r: headerRowIndex, c: C })];
      if (!cell) continue;

      const headerValue = String(cell.v).trim(); // 공백 제거 후 비교

      if (headerValue === "Status") statusColIndex = C;
      else if (headerValue === "Persona") personaColIndex = C;
      else if (headerValue === "Tone") toneColIndex = C;
    }

    return {
      headerRowIndex,
      statusColIndex,
      personaColIndex,
      toneColIndex,
    };
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
          persona: row["Persona"] || "informative",
          tone: row["Tone"] || "professional",
          category: row["카테고리"] || row["Category"],
          keywords: row["키워드"] || row["Keywords"],
          status: row["상태"] || row["Status"] || "대기",
        };
      });
    } catch (error) {
      console.error("Excel Parsing Error:", error);
      throw Error("Excel Parsing Error");
    }
  }

  /**
   * 특정 작업의 상태, 페르소나, 톤을 업데이트합니다.
   */
  static updateTaskInExcel(
    filePath: string,
    taskIndex: number,
    {
      status,
      persona,
      tone,
    }: { status?: BatchTask["status"]; persona?: Persona; tone?: Tone },
  ) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const { headerRowIndex, statusColIndex, personaColIndex, toneColIndex } =
        this.findHeaderInfo(worksheet);

      if (headerRowIndex === -1) {
        throw new Error("엑셀에서 헤더(Topic)를 찾을 수 없습니다.");
      }

      // 1. 마지막 컬럼 인덱스 찾기
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      let nextColIndex = range.e.c + 1;

      // 2. 각 컬럼의 타겟 인덱스 결정 (없으면 할당)
      let targetStatusCol = statusColIndex;
      let targetPersonaCol = personaColIndex;
      let targetToneCol = toneColIndex;

      const updates: { col: number; header: string; value?: string }[] = [];

      // Status 처리
      if (status) {
        if (targetStatusCol === -1) {
          targetStatusCol = nextColIndex++;
          // 헤더 추가 필요
          XLSX.utils.sheet_add_aoa(worksheet, [["Status"]], {
            origin: XLSX.utils.encode_cell({
              r: headerRowIndex,
              c: targetStatusCol,
            }),
          });
        }
        updates.push({ col: targetStatusCol, header: "Status", value: status });
      }

      // Persona 처리
      if (persona) {
        if (targetPersonaCol === -1) {
          targetPersonaCol = nextColIndex++; // Status가 추가되었다면 그 다음 칸
          XLSX.utils.sheet_add_aoa(worksheet, [["Persona"]], {
            origin: XLSX.utils.encode_cell({
              r: headerRowIndex,
              c: targetPersonaCol,
            }),
          });
        }
        updates.push({
          col: targetPersonaCol,
          header: "Persona",
          value: persona,
        });
      }

      // Tone 처리
      if (tone) {
        if (targetToneCol === -1) {
          targetToneCol = nextColIndex++;
          XLSX.utils.sheet_add_aoa(worksheet, [["Tone"]], {
            origin: XLSX.utils.encode_cell({
              r: headerRowIndex,
              c: targetToneCol,
            }),
          });
        }
        updates.push({ col: targetToneCol, header: "Tone", value: tone });
      }

      // 3. 데이터 값 쓰기
      // taskIndex는 0부터 시작, headerRowIndex 다음 줄부터 데이터
      const targetRow = headerRowIndex + 1 + taskIndex;

      updates.forEach(({ col, value }) => {
        if (value) {
          XLSX.utils.sheet_add_aoa(worksheet, [[value]], {
            origin: XLSX.utils.encode_cell({ r: targetRow, c: col }),
          });
        }
      });

      XLSX.writeFile(workbook, filePath);
      console.log(
        `✅ 엑셀 저장 성공 [Row: ${targetRow + 1}]: ${updates
          .map((u) => `${u.header}=${u.value}`)
          .join(", ")}`,
      );
    } catch (error) {
      console.error("❌ 엑셀 업데이트 실패:", error);
      throw new Error(
        "엑셀 파일 업데이트 실패. 파일이 열려있는지 확인해주세요.",
      );
    }
  }
}
