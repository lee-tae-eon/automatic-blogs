export const BLOG_PRESET = {
  naver: {
    tone: "실제 경험을 섞은 친근한 설명체",
    textLength: { min: 1200, max: 1200 },
    sections: 3,
  },
  tistory: {
    tone: "정보 중심의 명확한 설명체",
    textLength: { min: 1200, max: 1200 },
    sections: 3,
  },
} as const;
