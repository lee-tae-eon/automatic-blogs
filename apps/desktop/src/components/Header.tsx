import React from "react";

interface HeaderProps {
  credentials: {
    naverId: string;
    naverPw: string;
    geminiKey: string;
    subGemini: string;
    headless: boolean;
    modelType: "fast" | "normal";
  };
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '10px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#666', cursor: 'pointer' }}>
              <input
                name="headless"
                type="checkbox"
                checked={credentials.headless}
                onChange={onChange}
              />
              브라우저 숨기기
            </label>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #eee', paddingLeft: '12px' }}>
              <span style={{ fontSize: '0.75rem', color: '#888', fontWeight: '600' }}>AI 모델:</span>
              <select
                name="modelType"
                value={credentials.modelType}
                onChange={onChange}
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: credentials.modelType === 'fast' ? '1px solid #00d2ff' : '1px solid #ddd',
                  backgroundColor: credentials.modelType === 'fast' ? '#f0faff' : '#fff',
                  color: credentials.modelType === 'fast' ? '#0070f3' : '#333',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="normal">Normal (Flash 2.5)</option>
                <option value="fast">Fast (Flash 1.5)</option>
              </select>
            </div>
          </div>
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
