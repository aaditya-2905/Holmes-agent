import { memo } from "preact/compat";
import { useEffect, useMemo, useState } from "preact/hooks";

type Render = (src: string) => string;

// marked + DOMPurify are ~half the bundle and aren't needed for the first screen;
// load them on idle (see main.tsx) or on the first answer, whichever comes first.
let render: Render | null = null;
let loading: Promise<Render> | null = null;

export function loadMarkdown(): Promise<Render> {
  loading ??= import("../markdown").then((m) => (render = m.renderMarkdown));
  return loading;
}

export const Markdown = memo(function Markdown({ src, class: cls }: { src: string; class?: string }) {
  const [ready, setReady] = useState(render !== null);
  useEffect(() => {
    if (!ready) void loadMarkdown().then(() => setReady(true));
  }, [ready]);
  const html = useMemo(() => (ready && render ? render(src) : null), [src, ready]);

  if (html === null) return <div class={`md plain ${cls ?? ""}`}>{src}</div>;
  // Sanitized by DOMPurify in renderMarkdown.
  return <div class={`md ${cls ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
});
