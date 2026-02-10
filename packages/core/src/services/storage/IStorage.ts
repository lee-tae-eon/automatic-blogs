export interface NewsCache {
  topic: string;
  content: string;
  references: { name: string; url: string }[]; // v3.20: 제목과 URL 정보 포함
  created_at: string;
}

export interface IStorage {
  /**
   * 초기화 (스키마 생성 등)
   */
  init(): void;

  /**
   * 뉴스 데이터 저장
   */
  saveNews(topic: string, content: string, references: { name: string; url: string }[]): void;

  /**
   * 최근 뉴스 데이터 조회
   */
  getRecentNews(topic: string): NewsCache | null;

  /**
   * 뉴스 데이터 삭제 (에러 발생 시 캐시 무효화용)
   */
  deleteNews(topic: string): void;

  /**
   * 생성된 포스트 저장
   */
  savePost(topic: string, persona: string, tone: string, publication: any): void;

  /**
   * 캐시된 포스트 조회
   */
  getCachedPost(topic: string, persona: string, tone: string): any | null;

  /**
   * 연결 종료
   */
  close(): void;
}
