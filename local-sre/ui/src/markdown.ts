import DOMPurify from "dompurify";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: false, async: false });

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

// Answers are immutable once received, so memoize the parse + sanitize by source string.
const cache = new Map<string, string>();

/** LLM output is untrusted: always sanitize before it reaches innerHTML. */
export function renderMarkdown(src: string): string {
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  const html = DOMPurify.sanitize(marked.parse(src) as string, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "iframe", "img"],
  });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  cache.set(src, html);
  return html;
}
