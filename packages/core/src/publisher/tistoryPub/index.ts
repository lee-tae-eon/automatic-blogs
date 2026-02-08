import axios from "axios";
import { IBlogPublisher, PublishOptions } from "../interface";
import { Publication } from "../../types/blog";

export class TistoryPublisher implements IBlogPublisher {
  private readonly API_BASE_URL = "https://www.tistory.com/apis";

  /**
   * 티스토리 API를 통해 포스트를 발행합니다.
   * 사전 조건: Access Token이 있어야 합니다.
   */
  async publish(options: PublishOptions, post: Publication): Promise<void> {
    const { accessToken, blogId, onProgress } = options;
    const { title, content, tags = [], category, references } = post;

    if (!accessToken) {
      throw new Error("Tistory Access Token이 필요합니다.");
    }

    try {
      onProgress?.("티스토리 API 연결 중...");

      // TODO: 마크다운 -> HTML 변환 (이미 되어있을 수 있음)
      // Tistory API는 output='html' 또는 'markdown' 지원하지만,
      // 우리는 이미 HTML로 변환된 컨텐츠를 가지고 있을 수 있음.
      // 여기서는 content가 HTML이라고 가정.
      
      let finalContent = content;
      // 출처 추가 로직 (NaverPublisher와 유사하게)
      if (references && references.length > 0) {
        const refHtml = `
          <br><hr><br>
          <p><strong>🔗 참고 자료</strong></p>
          <ul>
            ${references.map(ref => `<li><a href="${ref.url}" target="_blank">${ref.name}</a></li>`).join("")}
          </ul>
        `;
        finalContent += refHtml;
      }

      onProgress?.("티스토리 글 발행 요청 중...");
      
      const response = await axios.post(`${this.API_BASE_URL}/post/write`, null, {
        params: {
          access_token: accessToken,
          output: "json",
          blogName: blogId, // Tistory는 blogName이 식별자 (https://blogName.tistory.com)
          title: title,
          content: finalContent,
          visibility: 3, // 0: 비공개, 1: 보호, 3: 발행
          category: 0, // 기본 카테고리 (카테고리 ID 조회 필요)
          tag: tags.join(","),
          acceptComment: 1, // 댓글 허용
        },
      });

      if (response.data.tistory.status === "200") {
        const url = response.data.tistory.url;
        console.log(`✅ 티스토리 발행 완료: ${url}`);
        onProgress?.(`티스토리 발행 완료: ${url}`);
      } else {
        throw new Error(`티스토리 API 에러: ${response.data.tistory.error_message}`);
      }

    } catch (error: any) {
      console.error("❌ 티스토리 발행 실패:", error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 카테고리 목록을 조회합니다. (추후 구현 예정)
   */
  async getCategories(accessToken: string, blogName: string) {
    // 구현 예정
  }
}
