import { type FormEvent, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { api, mutationHeaders } from "./api";
import "./styles.css";
import { type Owner, type Profile, Workspace } from "./workspace";

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
