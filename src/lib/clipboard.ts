/**
 * Copy text to clipboard with error handling.
 * Returns { error } on failure or {} on success.
 */
export async function copyToClipboard(
  text: string,
): Promise<{ error?: { message: string } }> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return {};
    }
    // Fallback for older browsers or non-secure contexts
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return {};
  } catch {
    return {
      error: {
        message:
          "Failed to copy to clipboard. Please copy manually.",
      },
    };
  }
}
