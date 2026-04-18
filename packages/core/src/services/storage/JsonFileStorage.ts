import path from "path";
import fs from "fs";
import { IStorage, NewsCache } from "./IStorage";

interface JsonData {
  news: Record<string, NewsCache>;
  posts: Record<string, { content: any; created_at: string }>;
  publishedPosts: { 
    title: string; 
    url: string; 
    keywords: string[]; 
    category: string; 
    account: string;
    persona: string;
    tone: string;
    views: number;
    likes: number;
    comments: number;
    published_at: string;
  }[];
}

export class JsonFileStorage implements IStorage {
  private filePath: string;
  private data: JsonData = { news: {}, posts: {}, publishedPosts: [] };

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
        if (!this.data.publishedPosts) this.data.publishedPosts = [];
      } catch (e) {
        console.warn("JSON Storage load failed, resetting.");
        this.data = { news: {}, posts: {}, publishedPosts: [] };
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

  savePublishedPost(title: string, url: string, keywords: string[] = [], category: string = "", account: string = "", persona: string = "", tone: string = ""): void {
    const existingIndex = this.data.publishedPosts.findIndex(p => p.url === url);
    const newPost = {
      title, url, keywords, category, account, persona, tone,
      views: 0, likes: 0, comments: 0,
      published_at: new Date().toISOString()
    };
    
    if (existingIndex > -1) {
      this.data.publishedPosts[existingIndex] = { ...this.data.publishedPosts[existingIndex], ...newPost };
    } else {
      this.data.publishedPosts.push(newPost);
    }
    this.save();
  }

  updatePostMetrics(url: string, metrics: { views: number; likes: number; comments: number }): void {
    const post = this.data.publishedPosts.find(p => p.url === url);
    if (post) {
      post.views = metrics.views;
      post.likes = metrics.likes;
      post.comments = metrics.comments;
      this.save();
    }
  }

  getBestPerformingStyles(limit: number = 3): { persona: string; tone: string; avgViews: number }[] {
    const stats: Record<string, { totalViews: number; count: number }> = {};
    
    this.data.publishedPosts.forEach(p => {
      if (!p.persona || !p.tone) return;
      const key = `${p.persona}|${p.tone}`;
      if (!stats[key]) stats[key] = { totalViews: 0, count: 0 };
      stats[key].totalViews += p.views;
      stats[key].count += 1;
    });

    return Object.entries(stats)
      .map(([key, data]) => {
        const [persona, tone] = key.split("|");
        return { persona, tone, avgViews: data.totalViews / data.count };
      })
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, limit);
  }

  getRelatedPosts(keywords: string[], limit: number = 2, account?: string): { title: string; url: string }[] {
    let filtered = this.data.publishedPosts;
    if (account) {
      filtered = filtered.filter(p => p.account === account);
    }

    return filtered
      .filter(p => keywords.some(k => p.keywords.includes(k)))
      .sort((a, b) => {
        // ✅ [v11.9.3] 성과 기반 가중치 부여
        if (b.views !== a.views) return b.views - a.views;
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      })
      .slice(0, limit)
      .map(p => ({ title: p.title, url: p.url }));
  }

  close(): void {
    // 파일 기반이므로 별도 종료 없음
  }
}
