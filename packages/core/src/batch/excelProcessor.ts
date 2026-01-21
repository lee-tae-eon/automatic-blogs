// packages/core/src/batch/excelProcessor.ts

import * as XLSX from "xlsx";
import { BlogBatchInput } from "../types/blog";

/**
 * 엑셀 파일에서 블로그 포스트 입력 데이터 읽기
 */
export async function readBlogInputsFromExcel(
  filePath: string,
): Promise<BlogBatchInput[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // 엑셀을 JSON으로 변환
  const rows = XLSX.utils.sheet_to_json(sheet) as any[];

  // 유효성 검사 및 변환
  const inputs: BlogBatchInput[] = rows.map((row, index) => {
    // 필수 필드 검증
    if (!row["주제"] || !row["페르소나"] || !row["카테고리"]) {
      throw new Error(
        `행 ${index + 2}: 필수 필드 누락 (주제, 페르소나, 카테고리는 필수입니다)`,
      );
    }

    // 페르소나 검증
    const persona = row["페르소나"].toLowerCase();
    if (persona !== "informative" && persona !== "empathetic") {
      throw new Error(
        `행 ${index + 2}: 페르소나는 'informative' 또는 'empathetic'만 가능합니다`,
      );
    }

    return {
      topic: row["주제"],
      persona: persona as "informative" | "empathetic",
      category: row["카테고리"],
      tone: row["톤"] || undefined,
    };
  });

  return inputs;
}

/**
 * 엑셀 템플릿 생성
 */
export function createExcelTemplate(outputPath: string) {
  const templateData = [
    {
      주제: "5살 아이와 태국 여행 준비물",
      페르소나: "empathetic",
      카테고리: "여행",
      톤: "친근하고 따뜻한",
    },
    {
      주제: "부산 일본 배편 예약 완벽 가이드",
      페르소나: "informative",
      카테고리: "여행/교통",
      톤: "전문적이고 명확한",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "블로그 포스트");

  XLSX.writeFile(workbook, outputPath);
  console.log(`✅ 엑셀 템플릿 생성 완료: ${outputPath}`);
}
