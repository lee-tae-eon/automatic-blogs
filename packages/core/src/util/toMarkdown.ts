import { BlogPost } from "../types/blog";

export function toMarkdown(post: BlogPost): string {
  return `# ${post.title}

${post.content}
`;
}
// export function toMarkdown(post: BlogPost): string {
//   const outlineMd = post.outline.map((section) => `## ${section}`).join("\n\n");

//   return `# ${post.title}

// ${post.content}
// `;
// }
