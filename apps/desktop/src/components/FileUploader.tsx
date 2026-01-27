import React, { useRef } from "react";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // 같은 파일을 다시 선택할 수 있도록 초기화
      e.target.value = "";
    }
  };

  const handleZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".xlsx, .xls, .csv"
        style={{ display: "none" }}
      />
      <div className="drop-zone" onClick={handleZoneClick}>
        <p>📁 클릭하여 엑셀 파일을 선택하세요.</p>
        <span>지원 형식: .xlsx, .csv</span>
      </div>
    </>
  );
};
