import path from "path";
import fs from "fs";
import { IStorage, NewsCache } from "./IStorage";

interface JsonData {
  news: Record<string, NewsCache>;
  posts: Record<string, { content: any; created_at: string }>;
}

export class JsonFileStorage implements IStorage {
  private filePath: string;
  private data: JsonData = { news: {}, posts: {} };

  constructor(rootDir: string) {
    const dataDir = path.join(rootDir, "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, "storage_fallback.json");
    this.load();
  }

  private load() {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(raw);
        if (!this.data.news) this.data.news = {};
        if (!this.data.posts) this.data.posts = {};
      } catch (e) {
        console.warn("JSON Storage load failed, resetting.");
        this.data = { news: {}, posts: {} };
      }
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("JSON Storage save failed:", e);
    }
  }

  init(): void {
    // JSON 파일은 별도 스키마 초기화 필요 없음
  }

  saveNews(topic: string, content: string, references: { name: string; url: string }[]): void {
    this.data.news[topic] = {
      topic,
      content,
      references, // v3.20
      created_at: new Date().toISOString(),
    };
    this.save();
  }

  getRecentNews(topic: string): NewsCache | null {
    // 24시간 체크 로직은 생략하거나 간단히 구현 가능
    return this.data.news[topic] || null;
  }

  deleteNews(topic: string): void {
    if (this.data.news[topic]) {
      delete this.data.news[topic];
      this.save();
    }
  }

  savePost(topic: string, persona: string, tone: string, publication: any): void {
    const key = `${topic}_${persona}_${tone}`;
    this.data.posts[key] = {
      content: publication,
      created_at: new Date().toISOString(),
    };
    this.save();
  }

  getCachedPost(topic: string, persona: string, tone: string): any | null {
    const key = `${topic}_${persona}_${tone}`;
    return this.data.posts[key]?.content || null;
  }

  close(): void {
    // 파일 기반이므로 별도 종료 없음
  }
}
