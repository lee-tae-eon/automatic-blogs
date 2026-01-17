import { BlogPost, GeneratePostInput } from "../types/blog";
// import { generateOutline } from "./generateOutline";
// import { generateArticle } from "./generateArticle";
// import { delay } from "../util/delay";
import { generatePostSingleCall } from "./generatePostSingleCall";

export async function generatePost({
  client,
  input,
}: GeneratePostInput): Promise<BlogPost> {
  const aiPost = await generatePostSingleCall(client, input);

  const post: BlogPost = {
    ...aiPost,
    platform: "naver",
    createdAt: new Date().toISOString(),
  };

  return post;
  // // 1. 목차 생성 (input 객체를 통째로 넘겨 주제와 톤을 반영)
  // const outlineData = await generateOutline(client, input);

  // await delay(3000);
  // // 2. 본문 생성 (생성된 목차를 기반으로 상세 내용 작성)
  // const content = await generateArticle(client, input, outlineData);

  // // 3. 최종 BlogPost 객체로 반환
  // return {
  //   title: outlineData.title,
  //   outline: outlineData.sections,
  //   content: content,
  // };
}
