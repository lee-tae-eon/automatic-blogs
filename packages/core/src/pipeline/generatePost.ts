import { BlogPostInput, BlogPost } from "../types/blog";

export async function generatePost(input: BlogPostInput): Promise<BlogPost> {
  return {
    title: `임시 제목: ${input.topic}`,
    outline: ["서론", "본문", "결론"],
    content: "여기에 본문이 들어옵니다.",
  };
}
