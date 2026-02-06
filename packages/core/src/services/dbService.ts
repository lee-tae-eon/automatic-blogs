import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 캐시 데이터 타입 정의
export interface NewsCache {
  topic: string;
  content: string;
  urls: string[];
  created_at: string;
}

export class DbService {
  private db: Database.Database;

  /**
   * DB 서비스 초기화
   * @param dbRootDir DB 파일이 저장될 루트 디렉토리 (Electron의 userData 경로 등)
   */
  constructor(dbRootDir: string) {
    // 1. 저장 폴더(data) 자동 생성
    // dbRootDir가 /Users/me/AppSupport라면 -> /Users/me/AppSupport/data 폴더 생성
    const dbDir = path.join(dbRootDir, "data");

    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch (e) {
        console.error(`❌ [DB] 폴더 생성 실패: ${e}`);
        // 폴더 생성 실패 시 임시 폴더나 현재 경로로 fallback 할 수도 있음
      }
    }

    // 2. DB 연결
    const dbPath = path.join(dbDir, "blog_automation.db");

    this.db = new Database(dbPath, {
      // verbose: console.log, // 쿼리 로그가 필요하면 주석 해제
    });

    // 3. 성능 최적화 (WAL 모드)
    // 쓰기 작업이 읽기 작업을 차단하지 않도록 함 (동시성 향상)
    this.db.pragma("journal_mode = WAL");

    // 4. 테이블 초기화
    this.initSchema();
  }

  /**
   * 테이블 스키마 생성
   */
  private initSchema() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS news_cache (
        topic TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        urls TEXT NOT NULL, -- JSON string으로 저장
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.exec(createTableQuery);

    // ✅ 생성된 포스트 캐시 테이블 추가
    const createPostCacheQuery = `
      CREATE TABLE IF NOT EXISTS post_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        persona TEXT NOT NULL,
        tone TEXT NOT NULL,
        content TEXT NOT NULL, -- Publication 객체(JSON)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.exec(createPostCacheQuery);
    
    // 인덱스 추가 (검색 속도 향상)
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_post_cache_keys ON post_cache (topic, persona, tone)");
  }

  /**
   * 생성된 포스트 캐시 저장
   */
  savePost(topic: string, persona: string, tone: string, publication: any) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO post_cache (topic, persona, tone, content)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(topic, persona, tone, JSON.stringify(publication));
      console.log(`💾 [DB] 포스트 캐시 저장 완료 (${topic} / ${persona} / ${tone})`);
    } catch (error) {
      console.error("❌ [DB] 포스트 캐시 저장 실패:", error);
    }
  }

  /**
   * 캐시된 포스트 조회
   */
  getCachedPost(topic: string, persona: string, tone: string): any | null {
    try {
      const stmt = this.db.prepare(`
        SELECT content FROM post_cache
        WHERE topic = ? AND persona = ? AND tone = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = stmt.get(topic, persona, tone) as any;
      if (!row) return null;
      
      console.log(`♻️ [DB] 포스트 캐시 히트! (${topic})`);
      return JSON.parse(row.content);
    } catch (error) {
      console.error("❌ [DB] 포스트 캐시 조회 실패:", error);
      return null;
    }
  }

  /**
   * 뉴스 데이터 저장 (Insert or Update)
   */
  saveNews(topic: string, content: string, urls: string[] = []) {
    try {
      // INSERT OR REPLACE: 같은 주제가 있으면 덮어씌움 (최신화)
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO news_cache (topic, content, urls, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      // 배열인 urls를 JSON 문자열로 변환하여 저장
      const info = stmt.run(topic, content, JSON.stringify(urls));
      console.log(
        `💾 [DB] 저장 완료 (Topic: ${topic}, RowID: ${info.lastInsertRowid})`,
      );
      return info;
    } catch (error) {
      console.error("❌ [DB] 뉴스 저장 실패:", error);
      throw error;
    }
  }

  /**
   * 최근 뉴스 데이터 조회 (24시간 이내)
   */
  getRecentNews(topic: string): NewsCache | null {
    try {
      // 24시간(-1 day) 이내의 데이터만 조회
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
        urls: JSON.parse(row.urls), // JSON 문자열을 다시 배열로 변환
        created_at: row.created_at,
      };
    } catch (error) {
      console.error("❌ [DB] 뉴스 조회 실패:", error);
      return null;
    }
  }

  /**
   * DB 연결 종료 (앱 종료 시 호출 권장)
   */
  close() {
    this.db.close();
    console.log("🔒 [DB] 연결 종료");
  }
}
