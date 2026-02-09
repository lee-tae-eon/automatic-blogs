import { Publication } from "../types/blog";

export interface PublishOptions {
  blogId: string;
  password?: string;
  headless?: boolean;
  accessToken?: string; // Tistory용 토큰
  onProgress?: (message: string) => void;
}

export interface IBlogPublisher {
  /**
   * 블로그에 포스트를 발행합니다.
   * @param options 발행 옵션 (인증 정보 등)
   * @param post 발행할 포스트 데이터
   * @returns 발행 성공 여부와 에러 메시지
   */
  publish(options: PublishOptions, post: Publication): Promise<void>;
}
