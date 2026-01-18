/// <reference lib="dom" />
export function injectEditor(html: string) {
  const editor = document.querySelector(".se-content") as HTMLElement | null;
  if (!editor) return;

  editor.innerHTML = html;

  editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));

  editor.focus();
}
