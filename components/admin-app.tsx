"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Building2, GraduationCap, LayoutDashboard, LogOut, RefreshCw, ShieldCheck, Users } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../lib/supabase-browser";

type AssignedGroup = {
  id: string;
  name: string;
  grade: string | null;
  academic_year: string | null;
};

type AdminPortal = {
  profile: {
    user_id: string;
    full_name: string | null;
    institution_id: string;
    institution: string | null;
    role: "institution_admin";
    assigned_groups: AssignedGroup[];
    account_status: string | null;
    last_access_at: string | null;
  };
  dashboard: {
    groups_total: number;
    students_active: number;
    students_pending_activation: number | null;
    learning_units_total: number;
    learning_units_active: number | null;
    learning_units_archived: number | null;
    routes_total: number;
    system_status: string | null;
  };
};

function labelOrPending(value: string | number | null | undefined, pending = "Sin datos") {
  return value === null || value === undefined || value === "" ? pending : String(value);
}

function Metric({ label, value, pending = "No configurado" }: { label: string; value: number | string | null; pending?: string }) {
  return <section className="panel metric-card"><span>{label}</span><strong>{labelOrPending(value, pending)}</strong></section>;
}

function AdminLogin({ supabase }: { supabase: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError("Credenciales no válidas.");
    setBusy(false);
  }

  return <main className="login-page" data-testid="admin-login-page">
    <section className="panel login-card">
      <div className="brand login-brand"><div className="brand-mark"><ShieldCheck size={24} /></div><div><strong>ENS English</strong><span>Portal institucional local</span></div></div>
      <span className="eyebrow">ACCESO PRIVADO</span>
      <h1>Administración</h1>
      <p>Este acceso está reservado al administrador institucional. La autorización se valida nuevamente en Supabase.</p>
      <form className="login-form" onSubmit={submit}>
        <label>Correo<input data-testid="admin-login-email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input data-testid="admin-login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error ? <div className="form-error" data-testid="admin-login-error">{error}</div> : null}
        <button className="primary-button" data-testid="admin-login-submit" disabled={busy || !email || !password}>{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </section>
  </main>;
}

export default function AdminApp() {
  const supabase = getBrowserSupabase();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [portal, setPortal] = useState<AdminPortal | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadPortal = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const sessionResult = await supabase.auth.getSession();
    const hasSession = Boolean(sessionResult.data.session);
    setSignedIn(hasSession);
    if (!hasSession) {
      setPortal(null);
      setDenied(null);
      setLoading(false);
      setReady(true);
      return;
    }

    const result = await supabase.rpc("get_my_admin_portal_v1");
    if (result.error) {
      setPortal(null);
      setDenied("Su cuenta está autenticada, pero no tiene autorización institution_admin para este portal.");
    } else {
      setPortal(result.data as AdminPortal);
      setDenied(null);
    }
    setLoading(false);
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const timer = window.setTimeout(() => { void loadPortal(); }, 0);
    const { data } = supabase.auth.onAuthStateChange(() => window.setTimeout(() => { void loadPortal(); }, 0));
    return () => { window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [loadPortal, supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPortal(null);
    setDenied(null);
    setSignedIn(false);
  }

  if (!supabase) return <main className="loading-page">Supabase local no configurado.</main>;
  if (!ready) return <main className="loading-page"><RefreshCw className="spin" size={18} /> Validando acceso…</main>;
  if (!signedIn) return <AdminLogin supabase={supabase} />;

  if (denied || !portal) return <main className="login-page" data-testid="admin-access-denied">
    <section className="panel empty-state">
      <ShieldCheck size={36} />
      <span className="eyebrow">ACCESO DENEGADO</span>
      <h2>Portal institucional protegido</h2>
      <p>{denied ?? "No se pudo recuperar el contexto administrativo."}</p>
      <button className="secondary-button" data-testid="admin-denied-logout" onClick={signOut}>Cerrar sesión</button>
    </section>
  </main>;

  const { profile, dashboard } = portal;
  const initials = (profile.full_name ?? "AD").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="app-shell" data-testid="admin-portal">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><GraduationCap size={24} /></div><div><strong>ENS English</strong><span>Administración institucional</span></div></div>
      <nav aria-label="Navegación administrativa">
        <span className="nav-link active"><LayoutDashboard size={20} /><span>Inicio</span></span>
        <span className="nav-link"><Building2 size={20} /><span>Grupos</span></span>
        <span className="nav-link"><Users size={20} /><span>Estudiantes</span></span>
      </nav>
      <div className="staging-note">Entorno local · autorización institution_admin · sin datos productivos</div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <div><span className="eyebrow">ENS ENGLISH · ADMIN LOCAL</span><h1>Panel institucional</h1></div>
        <div className="topbar-actions">
          <div className="identity-chip" data-testid="admin-identity-chip"><div className="initials">{initials}</div><div><strong>{labelOrPending(profile.full_name)}</strong><span>Administrador institucional</span></div></div>
          <button className="icon-button" data-testid="admin-logout" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={19} /></button>
        </div>
      </header>

      {loading ? <div className="sync-note"><RefreshCw className="spin" size={14} /> Actualizando datos del backend…</div> : null}

      <section className="panel hero" data-testid="admin-profile">
        <div>
          <span className="eyebrow">PERFIL DEL DOCENTE-ADMINISTRADOR</span>
          <h2>{labelOrPending(profile.full_name)}</h2>
          <p>Los datos de identidad, institución, rol y acceso se obtienen del backend. El navegador no concede privilegios administrativos.</p>
          <dl className="profile-grid">
            <div><dt>Institución</dt><dd data-testid="admin-institution">{labelOrPending(profile.institution)}</dd></div>
            <div><dt>Rol</dt><dd data-testid="admin-role">{profile.role}</dd></div>
            <div><dt>Estado de cuenta</dt><dd>{labelOrPending(profile.account_status, "No configurado")}</dd></div>
            <div><dt>Último acceso</dt><dd>{profile.last_access_at ? new Date(profile.last_access_at).toLocaleString("es-CO") : "Sin datos"}</dd></div>
          </dl>
        </div>
        <div className="metric-placeholder"><span>Grupos asignados como docente</span><strong data-testid="admin-assigned-groups">{profile.assigned_groups.length}</strong><small>{profile.assigned_groups.length ? profile.assigned_groups.map((group) => group.name).join(", ") : "Sin datos"}</small></div>
      </section>

      <div className="metric-grid" data-testid="admin-dashboard">
        <Metric label="Grupos" value={dashboard.groups_total} />
        <Metric label="Estudiantes activos" value={dashboard.students_active} />
        <Metric label="Pendientes de activación" value={dashboard.students_pending_activation} pending="No configurado" />
        <Metric label="Learning Units" value={dashboard.learning_units_total} />
        <Metric label="Learning Units activas" value={dashboard.learning_units_active} pending="No configurado" />
        <Metric label="Learning Units archivadas" value={dashboard.learning_units_archived} pending="No configurado" />
        <Metric label="Rutas" value={dashboard.routes_total} />
        <Metric label="Estado del sistema" value={dashboard.system_status === "local_ready" ? "Local listo" : dashboard.system_status} pending="Pendiente" />
      </div>

      <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
    </main>
  </div>;
}
