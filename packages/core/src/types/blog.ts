export interface BlogPostInput {
  topic: string;
  tone?:
    | "informative" // 정보 전달 (백과사전식, 객관적)
    | "casual" // 친근함 (블로그, 커뮤니티 말투)
    | "story" // 스토리텔링 (경험담, 수필 느낌)
    | "professional" // 전문적 (비즈니스, 논문 요약 느낌)
    | "humorous" // 위트 있는 (드립, 재미 위주)
    | "empathetic"; // 공감되는 (위로, 고민 상담 느낌)
}

export interface BlogPost {
  title: string;
  outline: string[];
  content: string;
}
