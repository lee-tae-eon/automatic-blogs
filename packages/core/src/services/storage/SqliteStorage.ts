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

    // ✅ [v11.9] 발행된 포스팅 추적 테이블 및 성과 데이터 컬럼 확장
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS published_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        keywords TEXT,
        category TEXT,
        account TEXT,
        persona TEXT,
        tone TEXT,
        views INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ✅ [v11.9.2] Migration: 컬럼 존재 여부 확인 후 누락된 컬럼 추가
    const tableInfo = this.db.prepare("PRAGMA table_info(published_posts)").all() as any[];
    const columns = tableInfo.map(info => info.name);
    
    const requiredColumns = [
      { name: "account", type: "TEXT" },
      { name: "persona", type: "TEXT" },
      { name: "tone", type: "TEXT" },
      { name: "views", type: "INTEGER DEFAULT 0" },
      { name: "likes", type: "INTEGER DEFAULT 0" },
      { name: "comments", type: "INTEGER DEFAULT 0" },
      { name: "updated_at", type: "DATETIME DEFAULT CURRENT_TIMESTAMP" }
    ];

    for (const col of requiredColumns) {
      if (!columns.includes(col.name)) {
        console.log(`🔧 [SqliteStorage] Migration: ${col.name} 컬럼 추가 중...`);
        try {
          this.db.exec(`ALTER TABLE published_posts ADD COLUMN ${col.name} ${col.type}`);
        } catch (e: any) {
          console.error(`❌ [SqliteStorage] ${col.name} 컬럼 추가 실패:`, e.message);
        }
      }
    }
  }

  // ✅ [v5.2] 발행 성공 정보 저장 (v11.9 persona, tone 추가)
  savePublishedPost(title: string, url: string, keywords: string[] = [], category: string = "", account: string = "", persona: string = "", tone: string = ""): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO published_posts (title, url, keywords, category, account, persona, tone, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(title, url, keywords.join(","), category, account, persona, tone);
  }

  // ✅ [v11.9] 성과 데이터 업데이트
  updatePostMetrics(url: string, metrics: { views: number; likes: number; comments: number }): void {
    const stmt = this.db.prepare(`
      UPDATE published_posts 
      SET views = ?, likes = ?, comments = ?, updated_at = CURRENT_TIMESTAMP
      WHERE url = ?
    `);
    stmt.run(metrics.views, metrics.likes, metrics.comments, url);
  }

  // ✅ [v11.9] 최고 성과 페르소나/톤 조합 조회
  getBestPerformingStyles(limit: number = 3): { persona: string; tone: string; avgViews: number }[] {
    const stmt = this.db.prepare(`
      SELECT persona, tone, AVG(views) as avgViews 
      FROM published_posts
      WHERE persona IS NOT NULL AND persona != ''
      GROUP BY persona, tone
      ORDER BY avgViews DESC
      LIMIT ?
    `);
    return stmt.all(limit) as { persona: string; tone: string; avgViews: number }[];
  }

  // ✅ [v5.2] 연관 포스팅 검색 (키워드 기반 + 계정 필터링)
  getRelatedPosts(queryKeywords: string[], limit: number = 2, account?: string): { title: string; url: string }[] {
    if (!queryKeywords || queryKeywords.length === 0) return [];
    
    // [v11.10.2] 검색 정밀도 및 범위 개선: 공백 제거 및 단어 단위 분할
    const expandedKeywords = new Set<string>();
    queryKeywords.forEach(kw => {
      const clean = kw.trim();
      if (clean) {
        expandedKeywords.add(clean);
        expandedKeywords.add(clean.replace(/\s+/g, "")); // 공백 제거 버전 추가
        
        // 2단어 이상인 경우 단어별로도 분할 (예: "수족구 합병증" -> "수족구", "합병증")
        if (clean.includes(" ")) {
          clean.split(/\s+/).forEach(word => {
            if (word.length >= 2) expandedKeywords.add(word);
          });
        }
      }
    });

    const finalKeywords = Array.from(expandedKeywords);
    
    // 키워드 조건 구성
    const keywordConditions = finalKeywords.map(() => "keywords LIKE ?").join(" OR ");
    let query = `
      SELECT DISTINCT title, url FROM published_posts
      WHERE (${keywordConditions})
    `;
    const params: any[] = finalKeywords.map(k => `%${k}%`);

    // 계정 필터링 추가
    if (account) {
      query += ` AND account = ?`;
      params.push(account);
    }

    // ✅ [v11.9.3] 성과 기반 가중치 부여 (조회수 높은 순 -> 최신순)
    query += ` ORDER BY views DESC, published_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as { title: string; url: string }[];
  }

  // ✅ [v11.10] 발행 내역 전체 조회 (최신순)
  getPublishedHistory(limit: number = 50, account?: string): any[] {
    let query = `SELECT * FROM published_posts`;
    const params: any[] = [];

    if (account) {
      query += ` WHERE account = ?`;
      params.push(account);
    }

    query += ` ORDER BY published_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  saveNews(topic: string, content: string, references: { name: string; url: string }[]): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO news_cache (topic, content, urls, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    // 'urls' 컬럼에 구조화된 JSON 저장
    stmt.run(topic, content, JSON.stringify(references));
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
      references: JSON.parse(row.urls), // JSON 파싱 시 name, url 객체 배열이 됨
      created_at: row.created_at,
    };
  }

  deleteNews(topic: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM news_cache WHERE topic = ?
    `);
    stmt.run(topic);
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
