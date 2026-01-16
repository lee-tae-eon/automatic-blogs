import { generatePost } from "@blog-automation/core";

async function main() {
  const post = await generatePost({ topic: "5살 아이랑 태국 여행" });

  console.log(post);
}

main();
