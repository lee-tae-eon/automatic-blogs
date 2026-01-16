import dotenv from "dotenv";
import path from "path";
import { generatePost } from "@blog-automation/core";

// 루트 디렉토리의 .env 파일을 찾아 로드합니다.
dotenv.config({ path: path.join(__dirname, "../../../../.env") });

async function main() {
  const post = await generatePost({ topic: "5살 아이랑 태국 여행" });

  console.log(post);
}

main();
