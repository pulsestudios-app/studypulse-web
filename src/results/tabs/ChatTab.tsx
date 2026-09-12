import { useEffect, useRef, useState, type FormEvent } from "react";

import { trackEvent } from "../../lib/analytics";
import { COPY } from "../copy";
import { classifyBackendError, sendChat } from "../generationApi";
import type { ChatTurn } from "../resultParse";
import { InlineError, UpgradeNotice } from "../UpgradeNotice";
import type { TabContext } from "./tabContext";

const MAX_MESSAGE = 4000;

export function ChatTab({ ctx }: { ctx: TabContext }) {
  const { view, planTier } = ctx;
  // Hydrated from conversation_history (server-written); the phone starts empty every time.
  const [messages, setMessages] = useState<ChatTurn[]>(view.conversation);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: string; message: string } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasTranscript = view.transcript.fullText.trim().length > 0;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_MESSAGE);
    if (!content || busy) {
      return;
    }
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setError(null);
    // Phone: message_number counts user messages including this one, tracked before the request.
    trackEvent("chat_message_sent", { plan_tier: planTier, message_number: next.filter((m) => m.role === "user").length });
    try {
      const reply = await sendChat(view.transcript.fullText, next, view.id);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      // Server is the gate: 403 CHAT_LIMIT_REACHED carries the exact copy. Roll back the optimistic turn.
      setMessages(messages);
      setDraft(content);
      setError(classifyBackendError(e, "Could not send your message."));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <div className="tab-body chat">
      <p className="type-caption text-secondary">{hasTranscript ? COPY.chat.contextHint : COPY.chat.noTranscript}</p>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="chat-suggestions">
            {COPY.chat.suggestions.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => void send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble chat-${m.role}`}>
            {m.content}
          </div>
        ))}
        {busy ? (
          <div className="chat-bubble chat-assistant chat-typing" aria-label="Thinking">
            <span />
            <span />
            <span />
          </div>
        ) : null}
      </div>
      {error?.kind === "limit" ? (
        <UpgradeNotice message={error.message} button={COPY.upgrade.onPhone} feature="AI Chat" />
      ) : error ? (
        <InlineError title={COPY.chat.failedTitle} message={error.message} />
      ) : null}
      <form className="chat-form" onSubmit={onSubmit}>
        <input
          className="input"
          placeholder={COPY.chat.placeholder}
          value={draft}
          maxLength={MAX_MESSAGE}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
          aria-label="Message"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {COPY.chat.send}
        </button>
      </form>
    </div>
  );
}
