import dotenv from "dotenv";
import path from "path";
import { generatePost } from "@blog-automation/core";

// 1. .env 로드 (루트 경로 설정)
dotenv.config({ path: path.join(__dirname, "../../../../.env.local") });

async function main() {
  const post = await generatePost({ topic: "5살 아이랑 태국 여행" });

  console.log(post);
}

main();
