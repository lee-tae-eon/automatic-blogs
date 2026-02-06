import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { IStorage, NewsCache } from "./IStorage";

export class SqliteStorage implements IStorage {
  private db: Database.Database;

  constructor(dbRootDir: string) {
    const dbDir = path.join(dbRootDir, "data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, "blog_automation.db");
    
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  init(): void {
    const createNewsTable = `
      CREATE TABLE IF NOT EXISTS news_cache (
        topic TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        urls TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.exec(createNewsTable);

    const createPostTable = `
      CREATE TABLE IF NOT EXISTS post_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        persona TEXT NOT NULL,
        tone TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.exec(createPostTable);
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_post_cache_keys ON post_cache (topic, persona, tone)");
  }

  saveNews(topic: string, content: string, urls: string[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO news_cache (topic, content, urls, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(topic, content, JSON.stringify(urls));
  }

  getRecentNews(topic: string): NewsCache | null {
    const stmt = this.db.prepare(`
      SELECT * FROM news_cache
      WHERE topic = ?
      AND created_at > datetime('now', '-1 day')
    `);
    const row = stmt.get(topic) as any;
    if (!row) return null;
    return {
      topic: row.topic,
      content: row.content,
      urls: JSON.parse(row.urls),
      created_at: row.created_at,
    };
  }

  savePost(topic: string, persona: string, tone: string, publication: any): void {
    const stmt = this.db.prepare(`
      INSERT INTO post_cache (topic, persona, tone, content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(topic, persona, tone, JSON.stringify(publication));
  }

  getCachedPost(topic: string, persona: string, tone: string): any | null {
    const stmt = this.db.prepare(`
      SELECT content FROM post_cache
      WHERE topic = ? AND persona = ? AND tone = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(topic, persona, tone) as any;
    if (!row) return null;
    return JSON.parse(row.content);
  }

  close(): void {
    this.db.close();
  }
}
