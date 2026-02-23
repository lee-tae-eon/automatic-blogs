import { IStorage, NewsCache } from "./storage/IStorage";
import { SqliteStorage } from "./storage/SqliteStorage";
import { JsonFileStorage } from "./storage/JsonFileStorage";

export class DbService implements IStorage {
  private storage: IStorage;

  constructor(rootDir: string) {
    try {
      // 우선 SqliteStorage 시도
      this.storage = new SqliteStorage(rootDir);
      console.log("✅ [DbService] SQLite 저장소 활성화");
    } catch (error: any) {
      console.warn(`⚠️ [DbService] SQLite 초기화 실패 (${error.message}). JSON 파일 저장소로 전환합니다.`);
      this.storage = new JsonFileStorage(rootDir);
    }
  }

  init(): void {
    this.storage.init();
  }

  saveNews(topic: string, content: string, references: { name: string; url: string }[] = []): void {
    this.storage.saveNews(topic, content, references);
  }

  getRecentNews(topic: string): NewsCache | null {
    return this.storage.getRecentNews(topic);
  }

  deleteNews(topic: string): void {
    this.storage.deleteNews(topic);
  }

  savePost(topic: string, persona: string, tone: string, publication: any): void {
    this.storage.savePost(topic, persona, tone, publication);
  }

  getCachedPost(topic: string, persona: string, tone: string): any | null {
    return this.storage.getCachedPost(topic, persona, tone);
  }

  savePublishedPost(title: string, url: string, keywords: string[] = [], category: string = ""): void {
    this.storage.savePublishedPost(title, url, keywords, category);
  }

  getRelatedPosts(keywords: string[], limit: number = 2): { title: string; url: string }[] {
    return this.storage.getRelatedPosts(keywords, limit);
  }

  close(): void {
    this.storage.close();
  }
}