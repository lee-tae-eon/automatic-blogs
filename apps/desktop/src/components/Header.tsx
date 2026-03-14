import React from "react";

interface HeaderProps {
  credentials: {
    naverId: string;
    naverPw: string;
    naverCategory: string;
    naverId2: string;
    naverPw2: string;
    naverCategory2: string; // This line is already present, no change needed here based on the instruction's intent.
    geminiKey: string;
    subGemini: string;
    thirdGemini: string; // 추가
    headless: boolean;
    modelType: "3.1_pro" | "3.0_flash" | "3.1_flash_lite" | "2.5_flash" | "2.5_flash_lite";
    tistoryId: string;
    tistoryPw: string;
    enableNaver: boolean;
    enableNaver2: boolean;
    enableTistory: boolean;
  };
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
}

export const Header: React.FC<HeaderProps> = ({ credentials, onChange }) => {
  return (
    <header className="app-header" style={{ marginBottom: "20px" }}>
      <h1 style={{ margin: "0 0 15px 0", fontSize: "1.5rem", color: "#333" }}>
        🚀 AI 블로그 대량 발행기
      </h1>

      <div
        className="header-container"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* 왼쪽 박스: 플랫폼 정보 */}
        <div
          className="setting-box"
          style={{
            backgroundColor: "#f8f9fa",
            borderRadius: "12px",
            padding: "15px",
            border: "1px solid #e9ecef",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <h2
            style={{
              fontSize: "0.9rem",
              margin: "0 0 5px 0",
              color: "#495057",
            }}
          >
            🌐 플랫폼 정보 입력
          </h2>
          <div style={{ display: "flex", gap: "15px" }}>
            {/* 네이버 그룹 1 */}
            <div
              className="platform-group"
              style={{ flex: 1, opacity: credentials.enableNaver ? 1 : 0.6 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  name="enableNaver"
                  type="checkbox"
                  checked={credentials.enableNaver}
                  onChange={onChange}
                />
                <span
                  style={{
                    fontWeight: "bold",
                    color: "#03c75a",
                    fontSize: "0.85rem",
                  }}
                >
                  Naver 1
                </span>
              </div>
              <input
                name="naverId"
                type="text"
                placeholder="네이버 아이디"
                value={credentials.naverId}
                onChange={onChange}
                disabled={!credentials.enableNaver}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                name="naverPw"
                type="password"
                placeholder="비밀번호"
                value={credentials.naverPw}
                onChange={onChange}
                disabled={!credentials.enableNaver}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            {/* 네이버 그룹 2 (v5.3 Multi-Account) */}
            <div
              className="platform-group"
              style={{ flex: 1, opacity: credentials.enableNaver2 ? 1 : 0.6 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  name="enableNaver2"
                  type="checkbox"
                  checked={credentials.enableNaver2}
                  onChange={onChange}
                />
                <span
                  style={{
                    fontWeight: "bold",
                    color: "#03c75a",
                    fontSize: "0.85rem",
                  }}
                >
                  Naver 2
                </span>
              </div>
              <input
                name="naverId2"
                type="text"
                placeholder="네이버 아이디"
                value={credentials.naverId2}
                onChange={onChange}
                disabled={!credentials.enableNaver2}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                name="naverPw2"
                type="password"
                placeholder="비밀번호"
                value={credentials.naverPw2}
                onChange={onChange}
                disabled={!credentials.enableNaver2}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            {/* 티스토리 그룹 */}
            <div
              className="platform-group"
              style={{
                flex: 1,
                opacity: credentials.enableTistory ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  name="enableTistory"
                  type="checkbox"
                  checked={credentials.enableTistory}
                  onChange={onChange}
                />
                <span
                  style={{
                    fontWeight: "bold",
                    color: "#ff5c00",
                    fontSize: "0.85rem",
                  }}
                >
                  Tistory
                </span>
              </div>
              <input
                name="tistoryId"
                type="text"
                placeholder="블로그명 (ID)"
                value={credentials.tistoryId}
                onChange={onChange}
                disabled={!credentials.enableTistory}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                name="tistoryPw"
                type="password"
                placeholder="비밀번호"
                value={credentials.tistoryPw}
                onChange={onChange}
                disabled={!credentials.enableTistory}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>
          </div>
        </div>

        {/* 오른쪽 박스: AI 관련 정보 */}
        <div
          className="setting-box"
          style={{
            backgroundColor: "#f8f9fa",
            borderRadius: "12px",
            padding: "15px",
            border: "1px solid #e9ecef",
            display: "flex",
            flexDirection: "column",
            gap: "15px",
          }}
        >
          <h2
            style={{
              fontSize: "0.9rem",
              margin: "0 0 5px 0",
              color: "#495057",
            }}
          >
            🤖 AI 설정 및 키
          </h2>
          <div style={{ display: "flex", gap: "15px" }}>
            {/* AI Keys 그룹 */}
            <div className="platform-group" style={{ flex: 1.5 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#666",
                }}
              >
                Gemini API Keys
              </span>
              <input
                name="geminiKey"
                type="password"
                placeholder="1. Primary Key"
                value={credentials.geminiKey}
                onChange={onChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                name="subGemini"
                type="password"
                placeholder="2. Secondary Key"
                value={credentials.subGemini}
                onChange={onChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
              <input
                name="thirdGemini"
                type="password"
                placeholder="3. Third Key"
                value={credentials.thirdGemini}
                onChange={onChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "5px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                }}
              />
            </div>

            {/* AI 모델 그룹 */}
            <div className="platform-group" style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: "bold",
                  marginBottom: "8px",
                  color: "#666",
                }}
              >
                Generation Settings
              </span>
              <select
                name="modelType"
                value={credentials.modelType}
                onChange={onChange}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "4px",
                  border: "1px solid #ddd",
                  backgroundColor: "#fff",
                  fontSize: "0.8rem",
                  marginBottom: "8px",
                  cursor: "pointer",
                }}
              >
                <option value="3.1_pro">3.1 Pro (Preview)</option>
                <option value="3.0_flash">3.0 Flash (Preview)</option>
                <option value="3.1_flash_lite">3.1 Flash Lite (Preview)</option>
                <option value="2.5_flash">2.5 Flash</option>
                <option value="2.5_flash_lite">2.5 Flash Lite</option>
              </select>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "0.75rem",
                  color: "#666",
                  cursor: "pointer",
                }}
              >
                <input
                  name="headless"
                  type="checkbox"
                  checked={credentials.headless}
                  onChange={onChange}
                />
                브라우저 숨기기
              </label>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
