export interface BlogPostInput {
  topic: string;
  tone?: "informative" | "casual" | "story";
}

export interface BlogPost {
  title: string;
  outline: string[];
  content: string;
}
