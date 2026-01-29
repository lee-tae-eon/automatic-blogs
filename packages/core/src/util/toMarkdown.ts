import { Publication } from "../types/blog";

export function toMarkdown(post: Publication): string {
  // Frontmatter (YAML 형식) 추가
  const frontmatter = `---
title: "${post.title.replace(/"/g, '\\"')}"
date: "${post.createdAt}"
metaTitle: "${post.metaTitle ? post.metaTitle.replace(/"/g, '\\"') : ""}"
metaDescription: "${post.metaDescription ? post.metaDescription.replace(/"/g, '\\"') : ""}"
tags: [${post.focusKeywords ? post.focusKeywords.map((k) => `"${k}"`).join(", ") : ""}]
---`;

  return `${frontmatter}

# ${post.title}

${post.content}
`;
}
