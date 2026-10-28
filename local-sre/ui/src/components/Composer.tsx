import { memo } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { IconSend, IconStop } from "./Icons";

interface Props {
  busy: boolean;
  disabled: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export const Composer = memo(function Composer({ busy, disabled, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-grow up to the CSS max-height.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || busy || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <div class="composer-wrap">
      <form
        class="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={ref}
          rows={1}
          value={text}
          placeholder={disabled ? "Agent is offline…" : "Ask about this machine, its network, services or containers…"}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          autofocus
        />
        {busy ? (
          <button type="button" class="send stop" onClick={onStop} aria-label="Stop">
            <IconStop />
          </button>
        ) : (
          <button type="submit" class="send" disabled={!text.trim() || disabled} aria-label="Send">
            <IconSend />
          </button>
        )}
      </form>
      <div class="composer-hint">
        <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · answers can be wrong, check the evidence
      </div>
    </div>
  );
});
