import { render } from "preact";
import { App } from "./app";
import { loadMarkdown } from "./components/Markdown";
import "./styles.css";

try {
  const t = localStorage.getItem("theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch {
  /* storage unavailable: follow the system theme */
}

render(<App />, document.getElementById("app")!);

// Warm the markdown chunk once the first paint is done.
const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 300));
idle(() => void loadMarkdown());
