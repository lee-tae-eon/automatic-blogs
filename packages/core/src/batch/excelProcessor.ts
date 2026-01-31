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

  /**
   * 특정 작업의 상태, 페르소나, 톤을 업데이트합니다.
   */
  static updateTaskInExcel(
    filePath: string,
    taskIndex: number, // 엑셀의 데이터 행 기준 (0부터 시작)
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

      // ✅ 수정된 findHeaderInfo를 통해 모든 인덱스를 가져옴
      const { headerRowIndex, statusColIndex, personaColIndex, toneColIndex } =
        this.findHeaderInfo(worksheet);

      if (headerRowIndex === -1) {
        throw new Error("엑셀에서 헤더(Topic)를 찾을 수 없습니다.");
      }

      // 컬럼 업데이트 헬퍼 함수
      const updateCell = (colIndex: number, colName: string, value: string) => {
        let targetColIndex = colIndex;

        // 만약 컬럼이 없으면(-1), 맨 끝에 새로 추가
        if (targetColIndex === -1) {
          const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
          targetColIndex = range.e.c + 1;

          // 헤더 추가
          XLSX.utils.sheet_add_aoa(worksheet, [[colName]], {
            origin: XLSX.utils.encode_cell({
              r: headerRowIndex,
              c: targetColIndex,
            }),
          });
        }

        // 값 업데이트 (헤더 바로 다음 줄부터 데이터가 시작된다고 가정)
        // taskIndex는 데이터 배열에서의 인덱스이므로, 엑셀 행 번호는 headerRowIndex + 1 + taskIndex
        const targetRow = headerRowIndex + 1 + taskIndex;

        XLSX.utils.sheet_add_aoa(worksheet, [[value]], {
          origin: XLSX.utils.encode_cell({ r: targetRow, c: targetColIndex }),
        });
      };

      // ✅ 각 항목 업데이트 실행
      if (status) updateCell(statusColIndex, "Status", status);
      if (persona) updateCell(personaColIndex, "Persona", persona);
      if (tone) updateCell(toneColIndex, "Tone", tone);

      XLSX.writeFile(workbook, filePath);
      console.log(
        `✅ 엑셀 업데이트 완료 [Row ${headerRowIndex + 1 + taskIndex + 1}]: ` +
          `${status ? `Status=${status} ` : ""}` +
          `${persona ? `Persona=${persona} ` : ""}` +
          `${tone ? `Tone=${tone}` : ""}`,
      );
    } catch (error) {
      console.error("❌ 엑셀 업데이트 실패:", error);
      // 파일이 열려 있어서 저장이 안 되는 경우가 많으므로 에러 메시지 구체화
      throw new Error(
        "엑셀 파일 업데이트 실패. 파일이 열려있는지 확인해주세요.",
      );
    }
  }
}
