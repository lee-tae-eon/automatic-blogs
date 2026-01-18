/// <reference lib="dom" />
export function injectEditor(html: string) {
  const editor = document.querySelector(".se-content");

  if (editor) {
    editor.innerHTML = html;
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}
