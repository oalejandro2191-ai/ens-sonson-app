"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ClipboardCopy, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { getBrowserSupabase } from "../lib/supabase-browser";

type AdminGroup = {
  id: string;
  name: string;
  grade: string | null;
  status: string;
  archived_at: string | null;
};

type CreatedAccess = {
  full_name: string;
  email: string;
  group_name: string;
  password: string;
};

export default function AdminStudentCreate() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [ready, setReady] = useState(() => !supabase);
  const [authorized, setAuthorized] = useState(false);
  const [institution, setInstitution] = useState<string | null>(null);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccess | null>(null);

  const loadContext = useCallback(async () => {
    if (!supabase) return;
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      setReady(true);
      return;
    }
    const portal = await supabase.rpc("get_my_admin_portal_v1");
    if (portal.error) {
      setReady(true);
      return;
    }
    const groupResult = await supabase.rpc("get_admin_groups_v1");
    if (groupResult.error) {
      setError(groupResult.error.message);
      setReady(true);
      return;
    }
    const active = ((groupResult.data ?? []) as AdminGroup[]).filter((group) => group.status === "active" && !group.archived_at);
    setGroups(active);
    setInstitution((portal.data as { profile?: { institution?: string | null } })?.profile?.institution ?? null);
    setAuthorized(true);
    setReady(true);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadContext(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadContext]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setCreated(null);
    try {
      const response = await supabase.functions.invoke("admin-student-create", {
        body: {
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          group_id: groupId,
        },
      });
      if (response.error || !response.data?.ok) {
        throw new Error(response.data?.error ?? response.error?.message ?? "No fue posible crear el estudiante.");
      }
      setCreated({
        full_name: response.data.full_name,
        email: response.data.email,
        group_name: response.data.group_name,
        password: response.data.temporary_password,
      });
      setFullName("");
      setEmail("");
      setGroupId("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible crear el estudiante.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="loading-page"><RefreshCw className="spin" size={18} /> Validando autorización…</main>;
  if (!supabase) return <main className="loading-page">Supabase no configurado.</main>;
  if (!authorized) return <main className="login-page"><section className="panel empty-state"><ShieldCheck size={36} /><h2>Acceso administrativo requerido</h2><p>La creación manual de estudiantes exige una sesión institution_admin válida.</p><Link className="primary-button" href="/admin">Volver al portal</Link></section></main>;

  return <main className="main-content" data-testid="admin-student-create-page">
    <header className="topbar">
      <div><span className="eyebrow">ENS ENGLISH · ADMINISTRACIÓN</span><h1>Crear estudiante</h1><p>{institution ?? "Institución"}</p></div>
      <Link className="secondary-button" href="/admin"><ArrowLeft size={17} /> Volver al panel</Link>
    </header>

    {error ? <div className="form-error admin-feedback" data-testid="student-create-error">{error}</div> : null}

    {created ? <section className="panel temporary-access" data-testid="student-created-access">
      <div>
        <span className="eyebrow">CUENTA CREADA · CONTRASEÑA TEMPORAL</span>
        <h2>{created.full_name}</h2>
        <p>{created.email} · {created.group_name}</p>
        <code data-testid="student-created-password">{created.password}</code>
        <p>Esta contraseña se muestra únicamente en esta respuesta. El estudiante deberá cambiarla posteriormente.</p>
      </div>
      <button className="secondary-button" type="button" onClick={() => void navigator.clipboard.writeText(created.password)}><ClipboardCopy size={16} /> Copiar contraseña</button>
    </section> : null}

    <section className="admin-workspace">
      <form className="panel admin-editor" onSubmit={submit} data-testid="student-create-form">
        <div className="section-heading"><div><span className="eyebrow">CREACIÓN MANUAL SEGURA</span><h2>Nuevo estudiante</h2><p>La cuenta se crea únicamente dentro de su institución y se asigna de inmediato a un grupo activo.</p></div></div>
        <div className="form-grid">
          <label>Nombre completo<input data-testid="student-create-name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={160} /></label>
          <label>Correo de acceso<input data-testid="student-create-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="off" /></label>
          <label>Grupo<select data-testid="student-create-group" value={groupId} onChange={(event) => setGroupId(event.target.value)} required><option value="">Seleccione un grupo</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}{group.grade ? ` · Grado ${group.grade}` : ""}</option>)}</select></label>
        </div>
        <div className="form-note">No escriba contraseñas. ENS English genera una contraseña temporal fuerte en el servidor y nunca guarda esa contraseña en Git.</div>
        <button className="primary-button" data-testid="student-create-submit" type="submit" disabled={busy || !fullName.trim() || !email.trim() || !groupId}><Plus size={17} /> {busy ? "Creando…" : "Crear estudiante"}</button>
      </form>
    </section>
  </main>;
}
