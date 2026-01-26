// apps/desktop/src/components/Settings.tsx
export const Settings = () => {
  return (
    <div className="settings-container">
      <h2>⚙️ 플랫폼 계정 설정</h2>

      <section className="platform-section">
        <h3>네이버 블로그</h3>
        <input type="text" placeholder="네이버 아이디" />
        <input type="password" placeholder="네이버 비밀번호" />
      </section>

      <section className="platform-section">
        <h3>티스토리</h3>
        <input type="text" placeholder="티스토리 앱 키 (App Key)" />
        <input type="text" placeholder="블로그 이름" />
      </section>

      <button className="save-btn">설정 저장</button>
    </div>
  );
};
