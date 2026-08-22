"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Gamepad2,
  GraduationCap,
  Home,
  LogOut,
  RefreshCw,
  UserRound,
  UsersRound,
} from "lucide-react";
import { resolveStudentSection, type StudentSection } from "@/lib/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type AuthContext = {
  user_id: string;
  display_alias: string | null;
  school_id: string | null;
  role: string | null;
  profile_photo_path: string | null;
};

type PortalIdentity = {
  user_id: string;
  display_alias: string | null;
  app_role: string | null;
  institution_role: string | null;
  is_superadmin: boolean;
  school_id: string | null;
  profile_photo_path: string | null;
};

type IdentityView = {
  auth: AuthContext;
  portal: PortalIdentity;
  institution: string | null;
  grade: string | null;
  group: string | null;
};

const navigation: Array<{ key: StudentSection; label: string; icon: typeof Home }> = [
  { key: "inicio", label: "Inicio", icon: Home },
  { key: "aprender", label: "Aprender", icon: BookOpen },
  { key: "jugar", label: "Jugar", icon: Gamepad2 },
  { key: "progreso", label: "Progreso", icon: ChartNoAxesColumnIncreasing },
  { key: "companeros", label: "Compañeros", icon: UsersRound },
  { key: "perfil", label: "Perfil", icon: UserRound },
];

function routeFor(section: StudentSection) {
  return section === "inicio" ? "/estudiante" : `/estudiante/${section}`;
}

function roleLabel(role: string | null) {
  if (role === "institution_admin") return "Administrador institucional";
  if (role === "teacher") return "Docente";
  if (role === "student") return "Estudiante";
  if (role === "superadmin") return "Superadministrador";
  return "No disponible";
}

function LoginPanel({ supabase, onSignedIn }: { supabase: SupabaseClient; onSignedIn: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError("Credenciales no válidas. Verifique el usuario y la contraseña.");
      setSubmitting(false);
      return;
    }
    await onSignedIn();
    setSubmitting(false);
  }

  return (
    <main className="login-page" data-testid="login-page">
      <section className="panel login-card">
        <div className="brand login-brand">
          <div className="brand-mark" aria-hidden="true"><GraduationCap size={26} /></div>
          <div><strong>ENS English</strong><span>Supabase local</span></div>
        </div>
        <span className="eyebrow">ACCESO INSTITUCIONAL</span>
        <h1>Iniciar sesión</h1>
        <p>La sesión y la identidad se validan en el backend local.</p>
        <form onSubmit={submit} className="login-form">
          <label>Usuario<input data-testid="login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Contraseña<input data-testid="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <div className="form-error" role="alert" data-testid="login-error">{error}</div> : null}
          <button data-testid="login-submit" className="primary-button" type="submit" disabled={submitting}>{submitting ? "Ingresando…" : "Ingresar"}</button>
        </form>
      </section>
      <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
    </main>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return <section className="panel empty-state"><span className="eyebrow">BACKEND LOCAL</span><h2>{title}</h2><p>Sin progreso registrado para mostrar en este checkpoint.</p></section>;
}

function IdentityPanel({ identity }: { identity: IdentityView }) {
  return (
    <section className="panel profile-panel" data-testid="identity-panel">
      <span className="eyebrow">IDENTIDAD REAL DEL BACKEND</span>
      <h2>{identity.portal.display_alias ?? "No disponible"}</h2>
      <dl className="profile-grid">
        <div><dt>Rol</dt><dd>{roleLabel(identity.portal.institution_role)}</dd></div>
        <div><dt>Institución</dt><dd>{identity.institution ?? "No disponible"}</dd></div>
        <div><dt>Grado</dt><dd>{identity.grade ?? "Pendiente de asignación"}</dd></div>
        <div><dt>Grupo</dt><dd>{identity.group ?? "Pendiente de asignación"}</dd></div>
      </dl>
    </section>
  );
}

export function StudentApp({ section }: { section: string[] }) {
  const active = resolveStudentSection(section);
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [ready, setReady] = useState(() => !supabase);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [identity, setIdentity] = useState<IdentityView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIdentity = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const hasSession = Boolean(sessionData.session);
    setSignedIn(hasSession);
    if (!hasSession) {
      setIdentity(null);
      setLoading(false);
      setReady(true);
      return;
    }

    const [authResult, portalResult] = await Promise.all([
      supabase.rpc("get_my_auth_context"),
      supabase.rpc("get_my_portal_identity_v1"),
    ]);
    if (authResult.error || portalResult.error) {
      setError(authResult.error?.message ?? portalResult.error?.message ?? "No se pudo recuperar la identidad.");
      setLoading(false);
      setReady(true);
      return;
    }

    const auth = authResult.data as AuthContext;
    const portal = portalResult.data as PortalIdentity;
    let institution: string | null = null;
    let grade: string | null = null;
    let group: string | null = null;

    if (portal.school_id) {
      const schoolResult = await supabase.from("schools").select("name").eq("id", portal.school_id).maybeSingle();
      if (!schoolResult.error && schoolResult.data) institution = String((schoolResult.data as { name: string }).name);
    }

    if (portal.institution_role === "student") {
      const membershipResult = await supabase.from("group_members").select("group_id").eq("student_id", portal.user_id).eq("status", "active").limit(1).maybeSingle();
      if (!membershipResult.error && membershipResult.data) {
        const groupId = String((membershipResult.data as { group_id: string }).group_id);
        const groupResult = await supabase.from("groups").select("name,grade").eq("id", groupId).maybeSingle();
        if (!groupResult.error && groupResult.data) {
          group = String((groupResult.data as { name: string }).name);
          grade = (groupResult.data as { grade: string | null }).grade;
        }
      }
    }

    setIdentity({ auth, portal, institution, grade, group });
    setLoading(false);
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    void loadIdentity();
    const { data } = supabase.auth.onAuthStateChange(() => { void loadIdentity(); });
    return () => data.subscription.unsubscribe();
  }, [loadIdentity, supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIdentity(null);
    setSignedIn(false);
  }

  if (!supabase) return <EmptyPanel title="Supabase local no configurado" />;
  if (!ready) return <main className="loading-page"><RefreshCw className="spin" /> Cargando sesión…</main>;
  if (!signedIn) return <LoginPanel supabase={supabase} onSignedIn={loadIdentity} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><GraduationCap size={24} /></div><div><strong>ENS English</strong><span>Local · Supabase</span></div></div>
        <nav aria-label="Navegación del estudiante">
          {navigation.map(({ key, label, icon: Icon }) => <Link key={key} href={routeFor(key)} className={`nav-link ${active === key ? "active" : ""}`}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}
        </nav>
        <div className="staging-note">Sesión real local · sin datos de producción</div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">ENS ENGLISH · LOCAL</span><h1>{navigation.find((item) => item.key === active)?.label ?? "Inicio"}</h1></div>
          {identity ? <div className="topbar-actions"><div className="identity-chip" data-testid="identity-chip"><div className="initials">{(identity.portal.display_alias ?? "ND").slice(0,2).toUpperCase()}</div><div><strong>{identity.portal.display_alias ?? "No disponible"}</strong><span>{roleLabel(identity.portal.institution_role)}</span></div></div><button data-testid="logout" className="icon-button" type="button" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={19} /></button></div> : null}
        </header>
        {error ? <div className="form-error page-error" role="alert">{error}</div> : null}
        {loading && identity ? <div className="sync-note"><RefreshCw className="spin" size={14} /> Actualizando sesión…</div> : null}
        {identity && (active === "inicio" || active === "perfil") ? <IdentityPanel identity={identity} /> : null}
        {identity && active !== "inicio" && active !== "perfil" ? <EmptyPanel title={navigation.find((item) => item.key === active)?.label ?? "Módulo"} /> : null}
        <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
      </main>
    </div>
  );
}
