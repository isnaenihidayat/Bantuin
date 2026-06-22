import { parseSseFrames } from "@bantuin/client";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { api, mutationHeaders } from "./api";

export type Owner = { id: string; email: string; createdAt: string };
export type Profile = {
  id: string;
  name: string;
  systemPrompt: string;
  providerModel: string | null;
  archivedAt?: string | null;
};
type Session = { id: string; profileId: string; title: string | null; updatedAt: string };
type MessageSource = { chunkId: string; documentId: string; sourceName: string; ordinal: number };
type MessageAttachment = {
  id: string;
  kind: "image" | "document";
  filename: string | null;
  mediaType: string;
  bytes: number;
  data: string;
};
type Message = {
  id: string;
  sessionId: string;
  sequence: number;
  role: "user" | "assistant";
  content: string;
  status: "pending" | "streaming" | "completed" | "failed" | "cancelled";
  sources?: MessageSource[];
  attachments?: MessageAttachment[];
};
type Memory = {
  id: string;
  type: "preference" | "fact" | "goal" | "note";
  content: string;
  status: "active" | "archived";
};
type KnowledgeDocument = { id: string; sourceName: string; bytes: number };
type ProviderModel = { id: string; name: string };
type WorkspaceView = "chat" | "history" | "profile" | "system" | "status" | "settings";
type SystemStatus = {
  health: { status: "ok"; apiVersion: string; timestamp: string };
  readiness: {
    status: "ready" | "not_ready";
    checks: { database: "ok" | "error"; providerConfiguration: "ok" | "error" };
    timestamp: string;
  };
};

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Tidak dapat membaca ${file.name}.`));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

const navigationGroups: Array<{
  label: string;
  items: Array<{ view: WorkspaceView; label: string }>;
}> = [
  {
    label: "Percakapan",
    items: [
      { view: "chat", label: "Chat" },
      { view: "history", label: "Riwayat" },
    ],
  },
  {
    label: "Asisten",
    items: [
      { view: "profile", label: "Profil" },
      { view: "system", label: "Sistem" },
    ],
  },
  { label: "Layanan", items: [{ view: "status", label: "Status" }] },
];

const viewTitles: Record<Exclude<WorkspaceView, "chat">, string> = {
  history: "Riwayat",
  profile: "Profil",
  system: "Sistem",
  status: "Status",
  settings: "Pengaturan",
};

function NavIcon({ name }: { name: WorkspaceView | "logout" | "collapse" }) {
  const paths: Record<typeof name, ReactNode> = {
    chat: <path d="M5 5h14v11H9l-4 3V5Z" />,
    history: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5l3 2" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="9" r="3" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
      </>
    ),
    system: (
      <>
        <path d="M9 3h6l1 3 3 1v6l-3 1-1 3H9l-1-3-3-1V7l3-1 1-3Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    status: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="M14 8l4 4-4 4m4-4H9" />
      </>
    ),
    collapse: (
      <>
        <path d="M4 5h16v14H4zM9 5v14" />
        <path d="m15 9-3 3 3 3" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export function Workspace({
  owner,
  initialProfile,
  onLogout,
}: {
  owner: Owner;
  initialProfile: Profile;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [profiles, setProfiles] = useState<Profile[]>([initialProfile]);
  const [selectedProfileId, setSelectedProfileId] = useState(initialProfile.id);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("chat");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [railCollapsed, setRailCollapsed] = useState(
    () => window.localStorage.getItem("bantuin.sidebar.collapsed") === "1",
  );
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = window.localStorage.getItem("bantuin.theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bantuin.theme", theme);
  }, [theme]);

  function toggleRail() {
    setRailCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("bantuin.sidebar.collapsed", next ? "1" : "0");
      return next;
    });
  }

  async function loadSessions(preferredId?: string) {
    const result = await api<{ sessions: Session[] }>("/v1/sessions");
    setSessions(result.sessions);
    const nextId = preferredId ?? selectedId ?? result.sessions[0]?.id ?? null;
    setSelectedId(nextId);
    if (nextId) await loadMessages(nextId);
  }

  async function loadProfiles(preferredId = selectedProfileId) {
    const result = await api<{ profiles: Profile[] }>("/v1/profiles");
    setProfiles(result.profiles);
    const selected = result.profiles.find((item) => item.id === preferredId) ?? result.profiles[0];
    if (selected) {
      setSelectedProfileId(selected.id);
      setProfile(selected);
    }
  }

  async function loadMessages(sessionId: string) {
    const result = await api<{ messages: Message[] }>(`/v1/sessions/${sessionId}/messages`);
    setMessages(result.messages);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: workspace bootstrap runs once for the authenticated owner.
  useEffect(() => {
    void loadProfiles(initialProfile.id).catch(() => undefined);
    void api<{ models: ProviderModel[] }>("/v1/models")
      .then((result) => setModels(result.models))
      .catch(() => undefined);
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
      body: JSON.stringify({ title: "Percakapan baru", profileId: selectedProfileId }),
    });
    setActiveView("chat");
    setMessages([]);
    await loadSessions(result.session.id);
    return result.session.id;
  }

  async function startNewSession() {
    setError("");
    try {
      await createSession();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Percakapan tidak dapat dibuat.");
      setActiveView("chat");
    }
  }

  async function openSession(sessionId: string) {
    setError("");
    setSelectedId(sessionId);
    setActiveView("chat");
    try {
      const session = sessions.find((item) => item.id === sessionId);
      const sessionProfile = session
        ? profiles.find((item) => item.id === session.profileId)
        : undefined;
      if (sessionProfile) {
        setSelectedProfileId(sessionProfile.id);
        setProfile(sessionProfile);
      }
      await loadMessages(sessionId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Percakapan tidak dapat dimuat.");
    }
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
        body: JSON.stringify({
          message: content,
          clientRequestId: crypto.randomUUID(),
          attachments: await Promise.all(
            pendingFiles.map(async (file) => ({
              kind: file.type.startsWith("image/") ? "image" : "document",
              filename: file.name,
              mediaType: file.type || (file.name.endsWith(".md") ? "text/markdown" : "text/plain"),
              data: await fileAsBase64(file),
            })),
          ),
        }),
      });
      await consumeStream(response);
      setPendingFiles([]);
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
    setSettingsError("");
    try {
      const result = await api<{ profile: Profile }>(`/v1/profiles/${selectedProfileId}`, {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({
          name: form.get("name"),
          systemPrompt: form.get("systemPrompt"),
          providerModel: form.get("providerModel") || null,
        }),
      });
      setProfile(result.profile);
      setProfiles((current) =>
        current.map((item) => (item.id === result.profile.id ? result.profile : item)),
      );
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Profil tidak dapat disimpan.");
    }
  }

  async function createProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSettingsError("");
    try {
      const result = await api<{ profile: Profile }>("/v1/profiles", {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ name: form.get("name"), systemPrompt: "", providerModel: null }),
      });
      await loadProfiles(result.profile.id);
      event.currentTarget.reset();
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Profil tidak dapat dibuat.");
    }
  }

  async function archiveProfile() {
    if (!window.confirm(`Arsipkan profil ${profile.name}? Riwayat chat tetap disimpan.`)) return;
    setSettingsError("");
    try {
      await api(`/v1/profiles/${profile.id}`, { method: "DELETE", headers: mutationHeaders });
      await loadProfiles();
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Profil tidak dapat diarsipkan.");
    }
  }

  async function selectProfile(id: string) {
    const selected = profiles.find((item) => item.id === id);
    if (!selected) return;
    setSelectedProfileId(id);
    setProfile(selected);
    setSelectedId(null);
    setMessages([]);
    setPendingFiles([]);
    if (activeView === "system") await loadSystemDataForProfile(id);
  }

  async function branchMessage(messageId: string) {
    if (!selectedId) return;
    setError("");
    try {
      const result = await api<{ session: Session }>(`/v1/sessions/${selectedId}/branch`, {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ messageId }),
      });
      await loadSessions(result.session.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Percakapan tidak dapat dicabangkan.");
    }
  }

  async function loadSystemDataForProfile(profileId: string) {
    setSettingsError("");
    try {
      const [memoryResult, knowledgeResult] = await Promise.all([
        api<{ memories: Memory[] }>("/v1/memories"),
        api<{ documents: KnowledgeDocument[] }>(
          `/v1/knowledge?profileId=${encodeURIComponent(profileId)}`,
        ),
      ]);
      setMemories(memoryResult.memories);
      setDocuments(knowledgeResult.documents);
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Data tidak dapat dimuat.");
    }
  }

  async function loadSystemData() {
    await loadSystemDataForProfile(selectedProfileId);
  }

  async function loadStatus() {
    setSettingsError("");
    try {
      const [healthResponse, readinessResponse] = await Promise.all([
        fetch("/health"),
        fetch("/ready"),
      ]);
      if (
        !healthResponse.ok ||
        (readinessResponse.status !== 200 && readinessResponse.status !== 503)
      ) {
        throw new Error("Status layanan tidak dapat dimuat.");
      }
      setSystemStatus({
        health: (await healthResponse.json()) as SystemStatus["health"],
        readiness: (await readinessResponse.json()) as SystemStatus["readiness"],
      });
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Status tidak dapat dimuat.");
    }
  }

  function openView(view: WorkspaceView) {
    setActiveView(view);
    setSettingsError("");
    if (view === "system") void loadSystemData();
    if (view === "status") void loadStatus();
  }

  async function createMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ memory: Memory }>("/v1/memories", {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({ type: form.get("type"), content: form.get("content") }),
      });
      setMemories((current) => [result.memory, ...current]);
      event.currentTarget.reset();
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Memori tidak dapat disimpan.");
    }
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ memory: Memory }>(`/v1/memories/${id}`, {
        method: "PATCH",
        headers: mutationHeaders,
        body: JSON.stringify({
          type: form.get("type"),
          content: form.get("content"),
          status: form.get("status"),
        }),
      });
      setMemories((current) =>
        current.map((memory) => (memory.id === id ? result.memory : memory)),
      );
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Memori tidak dapat diperbarui.");
    }
  }

  async function deleteMemory(id: string) {
    if (!window.confirm("Hapus memori ini secara permanen?")) return;
    try {
      await api(`/v1/memories/${id}`, { method: "DELETE", headers: mutationHeaders });
      setMemories((current) => current.filter((memory) => memory.id !== id));
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Memori tidak dapat dihapus.");
    }
  }

  async function uploadKnowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file");
    if (!(file instanceof File) || !file.name) return;
    setSettingsError("");
    try {
      if (file.size > 1024 * 1024 || !/\.(?:md|txt)$/iu.test(file.name)) {
        throw new Error("Pilih file .md atau .txt maksimal 1 MiB.");
      }
      const result = await api<{ document: KnowledgeDocument }>("/v1/knowledge", {
        method: "POST",
        headers: mutationHeaders,
        body: JSON.stringify({
          profileId: selectedProfileId,
          sourceName: file.name,
          content: await file.text(),
        }),
      });
      setDocuments((current) => [result.document, ...current]);
      event.currentTarget.reset();
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Dokumen tidak dapat diunggah.");
    }
  }

  async function deleteKnowledge(id: string) {
    if (!window.confirm("Hapus dokumen dan indeks pencariannya secara permanen?")) return;
    try {
      await api(`/v1/knowledge/${id}?profileId=${encodeURIComponent(selectedProfileId)}`, {
        method: "DELETE",
        headers: mutationHeaders,
      });
      setDocuments((current) => current.filter((document) => document.id !== id));
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Knowledge tidak dapat dihapus.");
    }
  }

  async function exportData() {
    setSettingsError("");
    try {
      const response = await fetch("/v1/export");
      if (!response.ok) throw new Error("Ekspor tidak dapat dibuat.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "bantuin-export.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Ekspor tidak dapat dibuat.");
    }
  }

  async function logout() {
    setSettingsError("");
    try {
      await api("/v1/auth/logout", { method: "POST", headers: mutationHeaders });
      onLogout();
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "Tidak dapat keluar.");
    }
  }

  return (
    <main className={railCollapsed ? "workspace rail-collapsed" : "workspace"}>
      <a className="skip-link" href="#main-content">
        Lewati ke konten utama
      </a>
      <aside className="session-rail" data-collapsed={railCollapsed || undefined}>
        <div className="rail-brand">
          <span className="brand-mark small" aria-hidden="true">
            B
          </span>
          <strong className="brand-name">Bantuin</strong>
          <button
            className="rail-collapse-button"
            type="button"
            aria-label={railCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            aria-expanded={!railCollapsed}
            title={railCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            onClick={toggleRail}
          >
            <NavIcon name="collapse" />
          </button>
        </div>
        <div className="workspace-scope" title="Workspace personal">
          <span>{profile.name[0]?.toUpperCase()}</span>
          <strong>Personal</strong>
        </div>
        <button
          className="new-chat"
          type="button"
          title="Percakapan baru"
          onClick={() => void startNewSession()}
        >
          <span className="new-chat-icon" aria-hidden="true">
            ＋
          </span>
          <span className="new-chat-label">Percakapan baru</span>
        </button>
        <nav className="workspace-nav" aria-label="Navigasi utama">
          {navigationGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => (
                <button
                  className={activeView === item.view ? "nav-link active" : "nav-link"}
                  key={item.view}
                  type="button"
                  title={item.label}
                  aria-current={activeView === item.view ? "page" : undefined}
                  onClick={() => openView(item.view)}
                >
                  <NavIcon name={item.view} />
                  <span className="nav-link-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="rail-footer">
          <button
            className={activeView === "settings" ? "rail-action active" : "rail-action"}
            type="button"
            title="Pengaturan"
            aria-current={activeView === "settings" ? "page" : undefined}
            onClick={() => openView("settings")}
          >
            <NavIcon name="settings" />
            <span>Pengaturan</span>
          </button>
          <button
            className="rail-action"
            type="button"
            title="Keluar"
            onClick={() => void logout()}
          >
            <NavIcon name="logout" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {activeView === "chat" ? (
        <section
          className={messages.length === 0 ? "conversation empty" : "conversation"}
          id="main-content"
          aria-label="Percakapan aktif"
        >
          <div className="message-list" aria-live="polite" aria-busy={Boolean(streamingId)}>
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
                  <p className="message-author">
                    {message.role === "user" ? "Kamu" : profile.name}
                  </p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="message-attachments">
                      {message.attachments.map((attachment) =>
                        attachment.kind === "image" ? (
                          <img
                            key={attachment.id}
                            src={`data:${attachment.mediaType};base64,${attachment.data}`}
                            alt={attachment.filename ?? "Lampiran gambar"}
                          />
                        ) : (
                          <span key={attachment.id}>▤ {attachment.filename ?? "Dokumen"}</span>
                        ),
                      )}
                    </div>
                  )}
                  <div className="message-content">
                    {message.content ? (
                      <Markdown>{message.content}</Markdown>
                    ) : (
                      <span className="typing-dots">•••</span>
                    )}
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <ul className="message-sources" aria-label="Sumber jawaban">
                      {message.sources.map((source) => (
                        <li key={source.chunkId}>
                          {source.sourceName} · bagian {source.ordinal + 1}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(message.status === "failed" || message.status === "cancelled") && (
                    <div className="message-state">
                      {message.status === "cancelled" ? "Balasan dihentikan." : "Balasan terputus."}
                      <button type="button" onClick={() => void retry(message)}>
                        Coba lagi
                      </button>
                    </div>
                  )}
                  {message.role === "assistant" && message.status === "completed" && (
                    <div className="message-actions">
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                      >
                        Salin
                      </button>
                      <button type="button" onClick={() => void branchMessage(message.id)}>
                        Buat cabang
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
            <form className="composer" onSubmit={send} aria-busy={Boolean(streamingId)}>
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
              <div className="composer-meta">
                <label className="attachment-button" title="Tambah lampiran">
                  ＋<span className="sr-only">Tambah lampiran</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/gif,image/webp,.txt,.md,text/plain,text/markdown"
                    onChange={(event) =>
                      setPendingFiles(Array.from(event.currentTarget.files ?? []).slice(0, 5))
                    }
                  />
                </label>
                <select
                  className="profile-chip"
                  aria-label="Profil asisten"
                  value={selectedProfileId}
                  disabled={Boolean(streamingId)}
                  onChange={(event) => void selectProfile(event.target.value)}
                >
                  {profiles.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span
                  className="model-label"
                  title={profile.providerModel ?? "Model provider default"}
                >
                  {profile.providerModel?.split("/").at(-1) ?? "Model default"}
                </span>
              </div>
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
            {pendingFiles.length > 0 && (
              <div className="pending-files">
                {pendingFiles.map((file) => (
                  <span key={`${file.name}-${file.size}`}>
                    {file.name}
                    <button
                      type="button"
                      aria-label={`Hapus ${file.name}`}
                      onClick={() =>
                        setPendingFiles((current) => current.filter((item) => item !== file))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <small aria-live="polite">
              {streamingId
                ? `${profile.name} sedang menjawab…`
                : "Enter untuk kirim · Shift + Enter untuk baris baru"}
            </small>
          </div>
        </section>
      ) : (
        <section className="page-shell" id="main-content" aria-labelledby="page-title">
          <header className="content-header">
            <h1 id="page-title">{viewTitles[activeView]}</h1>
          </header>
          <div className="page-view">
            {activeView === "history" && (
              <>
                <header className="page-heading">
                  <p>percakapan</p>
                  <h2>Semua percakapan</h2>
                  <span>Pilih percakapan untuk melanjutkan dari pesan terakhir.</span>
                </header>
                <div className="history-list">
                  {sessions.map((session) => (
                    <button
                      type="button"
                      key={session.id}
                      onClick={() => void openSession(session.id)}
                    >
                      <span>{session.title ?? "Tanpa judul"}</span>
                      <time dateTime={session.updatedAt}>
                        {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(session.updatedAt))}
                      </time>
                    </button>
                  ))}
                  {sessions.length === 0 && <p className="empty-page">Belum ada percakapan.</p>}
                </div>
              </>
            )}

            {activeView === "profile" && (
              <>
                <header className="page-heading">
                  <p>asisten</p>
                  <h2>Identitas asisten</h2>
                  <span>Atur identitas dan instruksi dasar asistenmu.</span>
                </header>
                {settingsError && (
                  <p className="form-error" role="alert">
                    {settingsError}
                  </p>
                )}
                <div className="profile-manager">
                  <aside className="profile-list">
                    {profiles.map((item) => (
                      <button
                        className={item.id === selectedProfileId ? "active" : undefined}
                        type="button"
                        key={item.id}
                        onClick={() => void selectProfile(item.id)}
                      >
                        <span>{item.name[0]?.toUpperCase()}</span>
                        {item.name}
                      </button>
                    ))}
                    <form onSubmit={createProfile}>
                      <input name="name" placeholder="Nama profil baru" required maxLength={80} />
                      <button className="secondary-button" type="submit">
                        Tambah
                      </button>
                    </form>
                  </aside>
                  <form className="page-form" key={profile.id} onSubmit={saveProfile}>
                    <label>
                      Nama asisten
                      <input name="name" defaultValue={profile.name} required maxLength={80} />
                    </label>
                    <label>
                      Model
                      <select name="providerModel" defaultValue={profile.providerModel ?? ""}>
                        <option value="">Gunakan model provider default</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Instruksi dasar
                      <textarea name="systemPrompt" defaultValue={profile.systemPrompt} rows={8} />
                    </label>
                    <div className="profile-actions">
                      <button className="secondary-button" type="submit">
                        Simpan profil
                      </button>
                      <button
                        className="danger-link"
                        type="button"
                        onClick={() => void archiveProfile()}
                      >
                        Arsipkan
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}

            {activeView === "system" && (
              <>
                <header className="page-heading">
                  <p>asisten</p>
                  <h2>Memori dan knowledge</h2>
                  <span>Kelola memori eksplisit dan knowledge lokal.</span>
                </header>
                {settingsError && (
                  <p className="form-error" role="alert">
                    {settingsError}
                  </p>
                )}
                <div className="system-grid">
                  <section className="settings-section">
                    <div className="section-heading">
                      <div>
                        <h2>Memori</h2>
                        <p>Hanya hal yang kamu simpan di sini yang diingat.</p>
                      </div>
                      <span>{memories.length}</span>
                    </div>
                    <form className="compact-form" onSubmit={createMemory}>
                      <label>
                        Jenis
                        <select name="type" defaultValue="preference">
                          <option value="preference">Preferensi</option>
                          <option value="fact">Fakta</option>
                          <option value="goal">Tujuan</option>
                          <option value="note">Catatan</option>
                        </select>
                      </label>
                      <label>
                        Isi memori
                        <textarea name="content" rows={2} maxLength={2000} required />
                      </label>
                      <button className="secondary-button" type="submit">
                        Tambah memori
                      </button>
                    </form>
                    <div className="settings-list">
                      {memories.map((memory) => (
                        <form
                          key={memory.id}
                          onSubmit={(event) => void saveMemory(event, memory.id)}
                        >
                          <div className="inline-fields">
                            <select
                              name="type"
                              defaultValue={memory.type}
                              aria-label="Jenis memori"
                            >
                              <option value="preference">Preferensi</option>
                              <option value="fact">Fakta</option>
                              <option value="goal">Tujuan</option>
                              <option value="note">Catatan</option>
                            </select>
                            <select
                              name="status"
                              defaultValue={memory.status}
                              aria-label="Status memori"
                            >
                              <option value="active">Aktif</option>
                              <option value="archived">Diarsipkan</option>
                            </select>
                          </div>
                          <textarea
                            name="content"
                            defaultValue={memory.content}
                            rows={2}
                            maxLength={2000}
                          />
                          <div className="row-actions">
                            <button type="submit">Simpan</button>
                            <button
                              className="danger-link"
                              type="button"
                              onClick={() => void deleteMemory(memory.id)}
                            >
                              Hapus
                            </button>
                          </div>
                        </form>
                      ))}
                      {memories.length === 0 && <p className="empty-setting">Belum ada memori.</p>}
                    </div>
                  </section>

                  <section className="settings-section">
                    <div className="section-heading">
                      <div>
                        <h2>Knowledge</h2>
                        <p>File teks lokal untuk membantu menjawab.</p>
                      </div>
                      <span>{documents.length}</span>
                    </div>
                    <form className="compact-form" onSubmit={uploadKnowledge}>
                      <label>
                        File .md atau .txt, maksimal 1 MiB
                        <input
                          name="file"
                          type="file"
                          accept=".md,.txt,text/plain,text/markdown"
                          required
                        />
                      </label>
                      <button className="secondary-button" type="submit">
                        Tambah knowledge
                      </button>
                    </form>
                    <ul className="document-list">
                      {documents.map((document) => (
                        <li key={document.id}>
                          <span>
                            <strong>{document.sourceName}</strong>
                            <small>{Math.max(1, Math.ceil(document.bytes / 1024))} KiB</small>
                          </span>
                          <button
                            className="danger-link"
                            type="button"
                            onClick={() => void deleteKnowledge(document.id)}
                          >
                            Hapus
                          </button>
                        </li>
                      ))}
                      {documents.length === 0 && (
                        <li className="empty-setting">Belum ada knowledge.</li>
                      )}
                    </ul>
                  </section>
                </div>
              </>
            )}

            {activeView === "status" && (
              <>
                <header className="page-heading">
                  <p>layanan</p>
                  <h2>Kondisi layanan</h2>
                  <span>Kondisi API, database, dan konfigurasi provider.</span>
                </header>
                {settingsError && (
                  <p className="form-error" role="alert">
                    {settingsError}
                  </p>
                )}
                <div className="status-list" aria-live="polite">
                  <div>
                    <span>API</span>
                    <strong data-state={systemStatus?.health.status ?? "loading"}>
                      {systemStatus ? `Aktif · v${systemStatus.health.apiVersion}` : "Memuat…"}
                    </strong>
                  </div>
                  <div>
                    <span>Database</span>
                    <strong data-state={systemStatus?.readiness.checks.database ?? "loading"}>
                      {!systemStatus
                        ? "Memuat…"
                        : systemStatus.readiness.checks.database === "ok"
                          ? "Siap"
                          : "Belum siap"}
                    </strong>
                  </div>
                  <div>
                    <span>OpenRouter</span>
                    <strong
                      data-state={systemStatus?.readiness.checks.providerConfiguration ?? "loading"}
                    >
                      {!systemStatus
                        ? "Memuat…"
                        : systemStatus.readiness.checks.providerConfiguration === "ok"
                          ? "Terkonfigurasi"
                          : "Belum dikonfigurasi"}
                    </strong>
                  </div>
                </div>
                <button
                  className="secondary-button refresh-status"
                  type="button"
                  onClick={() => void loadStatus()}
                >
                  Periksa ulang
                </button>
              </>
            )}

            {activeView === "settings" && (
              <>
                <header className="page-heading">
                  <p>akun</p>
                  <h2>Akun dan tampilan</h2>
                  <span>Kelola data lokal dan sesi pemilik Bantuin.</span>
                </header>
                {settingsError && (
                  <p className="form-error" role="alert">
                    {settingsError}
                  </p>
                )}
                <div className="account-summary">
                  <span className="owner-initial">{owner.email[0]?.toUpperCase()}</span>
                  <div>
                    <strong>{profile.name}</strong>
                    <small>{owner.email}</small>
                  </div>
                </div>
                <section className="settings-section settings-actions">
                  <div>
                    <h2>Data lokal</h2>
                    <p>Unduh profil, memori, knowledge, dan seluruh percakapan.</p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void exportData()}
                  >
                    Ekspor JSON
                  </button>
                </section>
                <section className="settings-section settings-actions">
                  <div>
                    <h2>Tema</h2>
                    <p>Gunakan tampilan yang nyaman untuk ruang kerjamu.</p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? "Gunakan tema terang" : "Gunakan tema gelap"}
                  </button>
                </section>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
