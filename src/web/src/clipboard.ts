export async function copyTextToClipboard(text: string): Promise<boolean> {
  const copiedWithSelection = copyTextWithSelection(text);
  if (copiedWithSelection) return true;

  if (navigator.clipboard?.writeText) {
    const copied = await Promise.race([
      navigator.clipboard.writeText(text).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) =>
        window.setTimeout(() => resolve(false), 250),
      ),
    ]);
    if (copied) return true;
  }

  return false;
}

function copyTextWithSelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
