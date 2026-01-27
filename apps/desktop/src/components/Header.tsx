import React from "react";

interface HeaderProps {
  credentials: {
    naverId: string;
    naverPw: string;
    geminiKey: string;
    subGemini: string;
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const Header: React.FC<HeaderProps> = ({ credentials, onChange }) => {
  return (
    <header className="app-header">
      <h1>🚀 AI 블로그 대량 발행기</h1>
      <div className="account-settings">
        <div className="platform-group">
          <span className="label">Naver</span>
          <input
            name="naverId"
            type="text"
            placeholder="아이디"
            value={credentials.naverId}
            onChange={onChange}
          />
          <input
            name="naverPw"
            type="password"
            placeholder="비밀번호"
            value={credentials.naverPw}
            onChange={onChange}
          />
        </div>
        <div className="platform-group">
          <span className="label">AI Keys</span>
          <input
            name="geminiKey"
            type="password"
            placeholder="Gemini Key"
            value={credentials.geminiKey}
            onChange={onChange}
          />
          <input
            name="subGemini"
            type="password"
            placeholder="sub-gemini"
            value={credentials.subGemini}
            onChange={onChange}
          />
        </div>
      </div>
    </header>
  );
};
