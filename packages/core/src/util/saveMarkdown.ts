import fs from "fs/promises";
import path from "path";
import { Publication } from "../types/blog";
import { toMarkdown } from "./toMarkdown";

export async function saveMarkdown(post: Publication, dir = "output") {
  await fs.mkdir(dir, { recursive: true });

  const safeTitle = post.title
    .replace(/[\/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, "_");

  const fileName = `${Date.now()}_${safeTitle}.md`;
  const filePath = path.join(dir, fileName);

  const markdown = toMarkdown(post);

  await fs.writeFile(filePath, markdown, "utf-8");

  return filePath;
}
