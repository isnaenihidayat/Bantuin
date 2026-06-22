import { parseSseFrames } from "@bantuin/client";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Owner = { id: string; email: string; createdAt: string };
type Profile = {
  id: string;
  name: string;
  systemPrompt: string;
  providerModel: string | null;
};
type Session = { id: string; title: string | null; updatedAt: string };
type Message = {
  id: string;
  sessionId: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "streaming" | "completed" | "failed" | "cancelled";
};

const mutationHeaders = { "content-type": "application/json", "x-csrf-token": "1" };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : response.json()) as Promise<T>;
}

function AuthScreen({
  setup,
  onAuthenticated,
}: {
  setup: boolean;
  onAuthenticated: (owner: Owner, profile: Profile) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ owner: Owner; profile: Profile }>(
        setup ? "/v1/setup" : "/v1/auth/login",
        {
          method: "POST",
          headers: mutationHeaders,
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
            ...(setup ? { assistantName: form.get("assistantName") } : {}),
          }),
        },
      );
      onAuthenticated(result.owner, result.profile);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tidak dapat masuk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <a className="skip-link" href="#auth-form">
        Lewati ke formulir
      </a>
      <section
        className="auth-panel"
        id="auth-form"
        aria-label={setup ? "Siapkan Bantuin" : "Masuk ke Bantuin"}
      >
        <div className="auth-heading">
          <span className="brand-mark" aria-hidden="true">
            ✦
          </span>
          <h1 id="auth-title">{setup ? "Siapkan Bantuin" : "Masuk ke Bantuin"}</h1>
          <p>
            {setup
              ? "Buat akun pemilik dan nama asistenmu."
              : "Masukkan kredensial untuk melanjutkan percakapan."}
          </p>
        </div>
        <form onSubmit={submit}>
          {setup && (
            <label>
              Nama asisten
              <input name="assistantName" defaultValue="Bantuin" maxLength={80} required />
            </label>
          )}
          <label>
            Email pemilik
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Kata sandi
            <input
              name="password"
              type="password"
              autoComplete={setup ? "new-password" : "current-password"}
              minLength={setup ? 12 : undefined}
              required
            />
            {setup && <small>Minimal 12 karakter. Hanya hash yang disimpan.</small>}
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Menyiapkan…" : setup ? "Mulai pakai Bantuin" : "Masuk"}
          </button>
        </form>
        <p className="privacy-note">SQLite lokal · provider pilihanmu · tanpa akun cloud Bantuin</p>
      </section>
    </main>
  );
}

function Workspace({
  owner,
  initialProfile,
  onLogout,
}: {
  owner: Owner;
  initialProfile: Profile;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function loadSessions(preferredId?: string) {
    const result = await api<{ sessions: Session[] }>("/v1/sessions");
    setSessions(result.sessions);
    const nextId = preferredId ?? selectedId ?? result.sessions[0]?.id ?? null;
    setSelectedId(nextId);
    if (nextId) await loadMessages(nextId);
  }

  async function loadMessages(sessionId: string) {
    const result = await api<{ messages: Message[] }>(`/v1/sessions/${sessionId}/messages`);
    setMessages(result.messages);
  }

  useEffect(() => {
    void api<{ sessions: Session[] }>("/v1/sessions")
      .then(async (result) => {
        setSessions(result.sessions);
        const firstId = result.sessions[0]?.id ?? null;
        setSelectedId(firstId);
        if (firstId) {
          const history = await api<{ messages: Message[] }>(`/v1/sessions/${firstId}/messages`);
          setMessages(history.messages);
        }
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Riwayat tidak dapat dimuat."),
      );
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: message changes trigger scrolling.
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    endRef.current?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  }, [messages]);

  async function createSession() {
    const result = await api<{ session: Session }>("/v1/sessions", {
      method: "POST",
      headers: mutationHeaders,
      body: JSON.stringify({ title: "Percakapan baru" }),
    });
    setMessages([]);
    await loadSessions(result.session.id);
    return result.session.id;
  }

  async function consumeStream(response: Response) {
    if (!response.ok || !response.body) throw new Error("Balasan tidak dapat dimulai.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let acceptedId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const boundary = buffer.lastIndexOf("\n\n");
      if (boundary >= 0) {
        const complete = buffer.slice(0, boundary + 2);
        buffer = buffer.slice(boundary + 2);
        for (const frame of parseSseFrames(complete)) {
          if (frame.data === "[DONE]") continue;
          const event = JSON.parse(frame.data) as Message & { delta?: string; messageId?: string };
          if (frame.event === "message.accepted") {
            acceptedId = event.id;
            setStreamingId(event.id);
            setMessages((current) => [...current.filter((item) => item.id !== event.id), event]);
          } else if (frame.event === "message.delta") {
            setMessages((current) =>
              current.map((item) =>
                item.id === acceptedId
                  ? { ...item, content: item.content + (event.delta ?? ""), status: "streaming" }
                  : item,
              ),
            );
          } else if (frame.event === "message.error") {
            setMessages((current) =>
              current.map((item) =>
                item.id === acceptedId ? { ...item, status: "failed" } : item,
              ),
            );
          } else if (frame.event === "message.completed") {
            setMessages((current) =>
              current.map((item) =>
                item.id === acceptedId ? { ...item, status: "completed" } : item,
              ),
            );
          } else if (frame.event === "message.cancelled") {
            setMessages((current) =>
              current.map((item) =>
                item.id === event.messageId ? { ...item, status: "cancelled" } : item,
              ),
            );
          }
        }
      }
      if (done) break;
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || streamingId) return;
    setDraft("");
    setError("");

    try {
      const sessionId = selectedId ?? (await createSession());
      const optimistic: Message = {
        id: `local-${crypto.randomUUID()}`,
        sessionId,
        sequence: messages.length + 1,
        role: "user",
        content,
        status: "completed",
      };
      setMessages((current) => [...current, optimistic]);
      const response = await fetch(`/v1/sessions/${sessionId}/messages`, {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ message: content, clientRequestId: crypto.randomUUID() }),
      });
      await consumeStream(response);
      await loadMessages(sessionId);
      await loadSessions(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pesan tidak dapat dikirim.");
    } finally {
      setStreamingId(null);
    }
  }

  async function cancel() {
    if (!streamingId) return;
    await api(`/v1/messages/${streamingId}/cancel`, {
      method: "POST",
      headers: mutationHeaders,
    });
  }

  async function retry(message: Message) {
    setError("");
    try {
      const response = await fetch(`/v1/messages/${message.id}/retry`, {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ clientRequestId: crypto.randomUUID() }),
      });
      await consumeStream(response);
      await loadMessages(message.sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Balasan tidak dapat diulang.");
    } finally {
      setStreamingId(null);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api<{ profile: Profile }>("/v1/profile", {
      method: "PATCH",
      headers: mutationHeaders,
      body: JSON.stringify({ name: form.get("name"), systemPrompt: form.get("systemPrompt") }),
    });
    setProfile(result.profile);
    setSettingsOpen(false);
  }

  async function logout() {
    await api("/v1/auth/logout", { method: "POST", headers: mutationHeaders });
    onLogout();
  }

  return (
    <main className="workspace">
      <a className="skip-link" href="#conversation-main">
        Lewati ke percakapan
      </a>
      <aside className="session-rail">
        <div className="rail-brand">
          <span className="brand-mark small" aria-hidden="true">
            ✦
          </span>
          <strong>Bantuin</strong>
        </div>
        <button className="new-chat" type="button" onClick={() => void createSession()}>
          <span aria-hidden="true">＋</span> Percakapan baru
        </button>
        <nav aria-label="Riwayat percakapan">
          <p className="nav-label">Riwayat</p>
          {sessions.length === 0 ? (
            <p className="empty-rail">Belum ada percakapan.</p>
          ) : (
            sessions.map((session) => (
              <button
                className={session.id === selectedId ? "session-link active" : "session-link"}
                key={session.id}
                type="button"
                onClick={() => {
                  setSelectedId(session.id);
                  void loadMessages(session.id);
                }}
              >
                {session.title ?? "Tanpa judul"}
              </button>
            ))
          )}
        </nav>
        <div className="owner-menu">
          <button type="button" onClick={() => setSettingsOpen((open) => !open)}>
            <span className="owner-initial">{owner.email[0]?.toUpperCase()}</span>
            <span>
              <strong>{profile.name}</strong>
              <small>{owner.email}</small>
            </span>
          </button>
        </div>
      </aside>

      <section
        className={messages.length === 0 ? "conversation empty" : "conversation"}
        id="conversation-main"
        aria-label="Percakapan aktif"
      >
        <div className="message-list" aria-live="polite">
          {messages.length === 0 ? (
            <div className="empty-conversation">
              <span aria-hidden="true">✦</span>
              <div>
                <h2>Selamat datang kembali.</h2>
                <p className="empty-copy">Apa yang bisa {profile.name} bantu hari ini?</p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <p className="message-author">{message.role === "user" ? "Kamu" : profile.name}</p>
                <div>{message.content || <span className="typing-dots">•••</span>}</div>
                {(message.status === "failed" || message.status === "cancelled") && (
                  <div className="message-state">
                    {message.status === "cancelled" ? "Balasan dihentikan." : "Balasan terputus."}
                    <button type="button" onClick={() => void retry(message)}>
                      Coba lagi
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="composer-wrap">
          {error && (
            <p className="composer-error" role="alert">
              {error}
            </p>
          )}
          <form className="composer" onSubmit={send}>
            <label className="sr-only" htmlFor="message-draft">
              Tulis pesan
            </label>
            <textarea
              id="message-draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Tanyakan apa saja…"
              rows={2}
              maxLength={4000}
            />
            {streamingId ? (
              <button className="stop-button" type="button" onClick={() => void cancel()}>
                <span aria-hidden="true">■</span>
                <span className="sr-only">Hentikan balasan</span>
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!draft.trim()}
                aria-label="Kirim pesan"
              >
                <span aria-hidden="true">↑</span>
              </button>
            )}
          </form>
          <small>Enter untuk kirim · Shift + Enter untuk baris baru</small>
        </div>
      </section>

      {settingsOpen && (
        <aside className="settings-panel" aria-label="Pengaturan asisten">
          <div className="settings-heading">
            <div>
              <p className="settings-kicker">identitas</p>
              <h2>Atur cara {profile.name} membantu.</h2>
            </div>
            <button
              type="button"
              aria-label="Tutup pengaturan"
              onClick={() => setSettingsOpen(false)}
            >
              ×
            </button>
          </div>
          <form onSubmit={saveProfile}>
            <label>
              Nama asisten
              <input name="name" defaultValue={profile.name} required maxLength={80} />
            </label>
            <label>
              Instruksi dasar
              <textarea name="systemPrompt" defaultValue={profile.systemPrompt} rows={8} />
            </label>
            <button className="primary-button" type="submit">
              Simpan perubahan
            </button>
          </form>
          <button className="logout-button" type="button" onClick={() => void logout()}>
            Keluar dari Bantuin
          </button>
        </aside>
      )}
    </main>
  );
}

function App() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "setup" }
    | { kind: "login" }
    | { kind: "workspace"; owner: Owner; profile: Profile }
  >({ kind: "loading" });

  useEffect(() => {
    void (async () => {
      const setup = await api<{ setupComplete: boolean }>("/v1/setup/status");
      if (!setup.setupComplete) return setState({ kind: "setup" });
      try {
        const me = await api<{ owner: Owner; profile: Profile }>("/v1/me");
        setState({ kind: "workspace", ...me });
      } catch {
        setState({ kind: "login" });
      }
    })();
  }, []);

  if (state.kind === "loading") {
    return (
      <div className="boot-screen">
        Menyiapkan meja kerja<span>…</span>
      </div>
    );
  }
  if (state.kind === "setup" || state.kind === "login") {
    return (
      <AuthScreen
        setup={state.kind === "setup"}
        onAuthenticated={(owner, profile) => setState({ kind: "workspace", owner, profile })}
      />
    );
  }
  return (
    <Workspace
      owner={state.owner}
      initialProfile={state.profile}
      onLogout={() => setState({ kind: "login" })}
    />
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element is missing");
createRoot(root).render(<App />);
