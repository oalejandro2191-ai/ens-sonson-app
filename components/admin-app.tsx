"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Archive,
  BookOpen,
  Building2,
  ClipboardCopy,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "../lib/supabase-browser";

type AssignedGroup = { id: string; name: string; grade: string | null; academic_year: string | null };
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

type AdminGroup = {
  id: string;
  name: string;
  grade: string | null;
  status: string;
  archived_at: string | null;
  academic_year_id: string | null;
  academic_year: string | null;
  students: number;
};

type AdminStudent = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  last_sign_in_at: string | null;
  group_id: string | null;
  group_name: string | null;
  grade: string | null;
  mastered: number;
  learning: number;
  review: number;
  xp: number;
};

type VocabularyItem = {
  id: string;
  learning_unit_id: string;
  unit_code: string;
  english: string;
  spanish: string;
  unit_type: string;
  accepted_forms: unknown;
  category: string;
  difficulty: number;
  example_en: string;
  example_es: string;
  priority: number;
  status: string;
  archived_at: string | null;
  audio_path: string | null;
  lesson_refs: number;
  attempt_refs: number;
  progress_refs: number;
};

type VocabularyResult = { total: number; items: VocabularyItem[] };
type AuditEvent = { id: number; actor_id: string; action: string; target_type: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string };
type AdminTab = "inicio" | "grupos" | "estudiantes" | "vocabulario" | "auditoria";

type VocabularyForm = {
  id?: string;
  english: string;
  spanish: string;
  unit_type: string;
  accepted_forms: string;
  category: string;
  difficulty: number;
  example_en: string;
  example_es: string;
  priority: number;
};

const emptyVocabularyForm: VocabularyForm = {
  english: "",
  spanish: "",
  unit_type: "word",
  accepted_forms: "",
  category: "general",
  difficulty: 1,
  example_en: "",
  example_es: "",
  priority: 1,
};

function labelOrPending(value: string | number | null | undefined, pending = "Sin datos") {
  return value === null || value === undefined || value === "" ? pending : String(value);
}

function Metric({ label, value, pending = "No configurado" }: { label: string; value: number | string | null; pending?: string }) {
  return <section className="panel metric-card"><span>{label}</span><strong>{labelOrPending(value, pending)}</strong></section>;
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const normalized = status ?? "unknown";
  return <span className={`status-pill ${normalized}`}>{normalized.replaceAll("_", " ")}</span>;
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
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) setError("Credenciales no válidas.");
    setBusy(false);
  }

  return <main className="login-page" data-testid="admin-login-page">
    <section className="panel login-card">
      <div className="brand login-brand"><div className="brand-mark"><ShieldCheck size={24} /></div><div><strong>ENS English</strong><span>Portal institucional Staging Alpha</span></div></div>
      <span className="eyebrow">ACCESO PRIVADO · STAGING</span>
      <h1>Administración</h1>
      <p>Ingrese con su cuenta administrativa institucional.</p>
      <form className="login-form" onSubmit={submit}>
        <label>Correo<input data-testid="admin-login-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Contraseña<input data-testid="admin-login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error ? <div className="form-error" data-testid="admin-login-error">{error}</div> : null}
        <button className="primary-button" data-testid="admin-login-submit" disabled={busy || !email || !password}>{busy ? "Ingresando…" : "Ingresar"}</button>
      </form>
    </section>
  </main>;
}

export default function AdminApp() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [portal, setPortal] = useState<AdminPortal | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AdminTab>("inicio");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [vocabulary, setVocabulary] = useState<VocabularyResult>({ total: 0, items: [] });
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupGrade, setGroupGrade] = useState("");
  const [editingGroup, setEditingGroup] = useState<AdminGroup | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentGroupFilter, setStudentGroupFilter] = useState("");
  const [studentGroupChoice, setStudentGroupChoice] = useState<Record<string, string>>({});
  const [temporaryAccess, setTemporaryAccess] = useState<{ name: string; password: string } | null>(null);
  const [vocabSearch, setVocabSearch] = useState("");
  const [vocabStatus, setVocabStatus] = useState("");
  const [vocabForm, setVocabForm] = useState<VocabularyForm>(emptyVocabularyForm);

  const clearFeedback = () => { setError(null); setNotice(null); };

  const loadPortal = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const sessionResult = await supabase.auth.getSession();
    const hasSession = Boolean(sessionResult.data.session);
    setSignedIn(hasSession);
    if (!hasSession) {
      setPortal(null); setDenied(null); setReady(true); setLoading(false); return;
    }
    const result = await supabase.rpc("get_my_admin_portal_v1");
    if (result.error) {
      setPortal(null);
      setDenied("Su cuenta está autenticada, pero no tiene autorización institution_admin para este portal.");
    } else {
      setPortal(result.data as AdminPortal);
      setDenied(null);
    }
    setReady(true);
    setLoading(false);
  }, [supabase]);

  const loadGroups = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.rpc("get_admin_groups_v1");
    if (result.error) throw result.error;
    setGroups((result.data ?? []) as AdminGroup[]);
  }, [supabase]);

  const loadStudents = useCallback(async (search = "", groupId = "") => {
    if (!supabase) return;
    const result = await supabase.rpc("get_admin_students_v1", {
      provided_search: search.trim() || null,
      provided_group_id: groupId || null,
    });
    if (result.error) throw result.error;
    setStudents((result.data ?? []) as AdminStudent[]);
  }, [supabase]);

  const loadVocabulary = useCallback(async (search = "", status = "") => {
    if (!supabase) return;
    const result = await supabase.rpc("get_admin_vocabulary_v1", {
      provided_search: search.trim() || null,
      provided_status: status || null,
      provided_limit: 150,
      provided_offset: 0,
    });
    if (result.error) throw result.error;
    setVocabulary((result.data ?? { total: 0, items: [] }) as VocabularyResult);
  }, [supabase]);

  const loadAudit = useCallback(async () => {
    if (!supabase) return;
    const result = await supabase.rpc("get_admin_audit_v1", { provided_limit: 60 });
    if (result.error) throw result.error;
    setAudit((result.data ?? []) as AuditEvent[]);
  }, [supabase]);

  const refreshAdminData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    clearFeedback();
    try {
      await loadPortal();
      const session = await supabase.auth.getSession();
      if (!session.data.session) return;
      const adminCheck = await supabase.rpc("get_my_admin_portal_v1");
      if (adminCheck.error) return;
      await Promise.all([loadGroups(), loadStudents("", ""), loadVocabulary("", ""), loadAudit()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible actualizar el portal.");
    } finally {
      setLoading(false);
    }
  }, [loadAudit, loadGroups, loadPortal, loadStudents, loadVocabulary, supabase]);

  useEffect(() => {
    if (!supabase) return;
    const timer = window.setTimeout(() => { void refreshAdminData(); }, 0);
    const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => { void refreshAdminData(); }, 0); });
    return () => { window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [refreshAdminData, supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPortal(null); setDenied(null); setSignedIn(false); setTemporaryAccess(null);
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    clearFeedback();
    const result = await supabase.rpc("admin_create_group_v1", { provided_name: groupName, provided_grade: groupGrade || null, provided_academic_year_id: null });
    if (result.error) { setError(result.error.message); return; }
    setGroupName(""); setGroupGrade(""); setNotice("Grupo creado y auditado.");
    await Promise.all([loadGroups(), loadPortal(), loadAudit()]);
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editingGroup) return;
    clearFeedback();
    const result = await supabase.rpc("admin_update_group_v1", {
      target_group_id: editingGroup.id,
      provided_name: editingGroup.name,
      provided_grade: editingGroup.grade || null,
      provided_academic_year_id: editingGroup.academic_year_id,
    });
    if (result.error) { setError(result.error.message); return; }
    setEditingGroup(null); setNotice("Grupo actualizado.");
    await Promise.all([loadGroups(), loadAudit()]);
  }

  async function setGroupArchived(group: AdminGroup, archive: boolean) {
    if (!supabase) return;
    if (archive && !window.confirm(`¿Archivar ${group.name}? El historial se conservará.`)) return;
    clearFeedback();
    const result = await supabase.rpc(archive ? "admin_archive_group_v1" : "admin_restore_group_v1", { target_group_id: group.id });
    if (result.error) { setError(result.error.message); return; }
    setNotice(archive ? "Grupo archivado sin eliminar historial." : "Grupo restaurado.");
    await Promise.all([loadGroups(), loadPortal(), loadAudit()]);
  }

  async function changeStudentStatus(student: AdminStudent, status: string) {
    if (!supabase) return;
    if (status === "archived" && !window.confirm(`¿Archivar a ${student.full_name ?? "este estudiante"}? Su progreso se conservará.`)) return;
    clearFeedback();
    const result = await supabase.rpc("admin_set_student_status_v1", { target_user_id: student.user_id, provided_status: status });
    if (result.error) { setError(result.error.message); return; }
    setNotice(`Estado actualizado a ${status.replaceAll("_", " ")}.`);
    await Promise.all([loadStudents(studentSearch, studentGroupFilter), loadPortal(), loadAudit()]);
  }

  async function assignStudentGroup(student: AdminStudent) {
    if (!supabase) return;
    const targetGroup = studentGroupChoice[student.user_id];
    if (!targetGroup) { setError("Seleccione un grupo antes de mover al estudiante."); return; }
    clearFeedback();
    const result = await supabase.rpc("admin_assign_student_group_v1", { target_user_id: student.user_id, target_group_id: targetGroup });
    if (result.error) { setError(result.error.message); return; }
    setNotice("Grupo del estudiante actualizado.");
    await Promise.all([loadStudents(studentSearch, studentGroupFilter), loadGroups(), loadAudit()]);
  }

  async function resetStudentAccess(student: AdminStudent) {
    if (!supabase) return;
    if (!window.confirm(`¿Generar una contraseña temporal nueva para ${student.full_name ?? "este estudiante"}?`)) return;
    clearFeedback();
    setTemporaryAccess(null);
    const result = await supabase.functions.invoke("admin-student-access", { body: { student_user_id: student.user_id } });
    if (result.error || !result.data?.ok) { setError(result.error?.message ?? result.data?.error ?? "No fue posible regenerar el acceso."); return; }
    setTemporaryAccess({ name: result.data.student_name ?? student.full_name ?? "Estudiante", password: result.data.temporary_password });
    setNotice("Acceso regenerado. La contraseña temporal se muestra una sola vez en este panel.");
    await loadAudit();
  }

  function editVocabulary(item: VocabularyItem) {
    const accepted = Array.isArray(item.accepted_forms) ? item.accepted_forms.join(", ") : "";
    setVocabForm({
      id: item.id, english: item.english, spanish: item.spanish, unit_type: item.unit_type,
      accepted_forms: accepted, category: item.category, difficulty: item.difficulty,
      example_en: item.example_en, example_es: item.example_es, priority: item.priority,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveVocabulary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    clearFeedback();
    const accepted = vocabForm.accepted_forms.split(",").map((value) => value.trim()).filter(Boolean);
    const common = {
      provided_english: vocabForm.english,
      provided_spanish: vocabForm.spanish,
      provided_unit_type: vocabForm.unit_type,
      provided_accepted_forms: accepted,
      provided_category: vocabForm.category,
      provided_difficulty: vocabForm.difficulty,
      provided_example_en: vocabForm.example_en || null,
      provided_example_es: vocabForm.example_es || null,
      provided_priority: vocabForm.priority,
    };
    const result = vocabForm.id
      ? await supabase.rpc("admin_update_vocabulary_word_v1", { target_word_id: vocabForm.id, ...common })
      : await supabase.rpc("admin_create_vocabulary_word_v1", common);
    if (result.error) { setError(result.error.message); return; }
    setVocabForm(emptyVocabularyForm);
    setNotice(vocabForm.id ? "Learning Unit actualizada y auditada." : "Learning Unit creada y auditada.");
    await Promise.all([loadVocabulary(vocabSearch, vocabStatus), loadPortal(), loadAudit()]);
  }

  async function setVocabularyArchived(item: VocabularyItem, archive: boolean) {
    if (!supabase) return;
    clearFeedback();
    const result = await supabase.rpc(archive ? "admin_archive_vocabulary_word_v1" : "admin_restore_vocabulary_word_v1", { target_word_id: item.id });
    if (result.error) { setError(result.error.message); return; }
    setNotice(archive ? "Learning Unit archivada; el historial anterior permanece intacto." : "Learning Unit restaurada.");
    await Promise.all([loadVocabulary(vocabSearch, vocabStatus), loadPortal(), loadAudit()]);
  }

  async function deleteUnusedVocabulary(item: VocabularyItem) {
    if (!supabase) return;
    if (!window.confirm(`Eliminar definitivamente “${item.english}”? Solo se permitirá si nunca ha sido usada.`)) return;
    clearFeedback();
    const result = await supabase.rpc("admin_delete_unused_vocabulary_word_v1", { target_word_id: item.id });
    if (result.error) { setError(result.error.message); return; }
    setNotice("Learning Unit sin historial eliminada definitivamente.");
    await Promise.all([loadVocabulary(vocabSearch, vocabStatus), loadPortal(), loadAudit()]);
  }

  if (!supabase) return <main className="loading-page">Supabase no configurado.</main>;
  if (!ready) return <main className="loading-page"><RefreshCw className="spin" size={18} /> Validando acceso…</main>;
  if (!signedIn) return <AdminLogin supabase={supabase} />;

  if (denied || !portal) return <main className="login-page" data-testid="admin-access-denied">
    <section className="panel empty-state">
      <ShieldCheck size={36} /><span className="eyebrow">ACCESO DENEGADO</span><h2>Portal institucional protegido</h2>
      <p>{denied ?? "No se pudo recuperar el contexto administrativo."}</p>
      <button className="secondary-button" data-testid="admin-denied-logout" onClick={signOut}>Cerrar sesión</button>
    </section>
  </main>;

  const { profile, dashboard } = portal;
  const initials = (profile.full_name ?? "AD").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const activeGroups = groups.filter((group) => group.status === "active" && !group.archived_at);
  const nav: Array<{ key: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { key: "inicio", label: "Inicio", icon: LayoutDashboard },
    { key: "grupos", label: "Grupos", icon: Building2 },
    { key: "estudiantes", label: "Estudiantes", icon: Users },
    { key: "vocabulario", label: "Vocabulario", icon: BookOpen },
    { key: "auditoria", label: "Auditoría", icon: ShieldCheck },
  ];

  return <div className="app-shell" data-testid="admin-portal">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><GraduationCap size={24} /></div><div><strong>ENS English</strong><span>Administración institucional</span></div></div>
      <nav aria-label="Navegación administrativa">
        {nav.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={`nav-link nav-button ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      <div className="staging-note">STAGING ALPHA · institution_admin · datos ficticios</div>
    </aside>

    <main className="main-content">
      <header className="topbar">
        <div><span className="eyebrow">ENS ENGLISH · STAGING ALPHA</span><h1>{nav.find((item) => item.key === tab)?.label}</h1></div>
        <div className="topbar-actions">
          <button className="icon-button" title="Actualizar" onClick={() => void refreshAdminData()}><RefreshCw className={loading ? "spin" : ""} size={18} /></button>
          <div className="identity-chip" data-testid="admin-identity-chip"><div className="initials">{initials}</div><div><strong>{labelOrPending(profile.full_name)}</strong><span>Administrador institucional</span></div></div>
          <button className="icon-button" data-testid="admin-logout" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={19} /></button>
        </div>
      </header>

      {error ? <div className="form-error admin-feedback">{error}</div> : null}
      {notice ? <div className="form-note admin-feedback">{notice}</div> : null}

      {tab === "inicio" ? <>
        <section className="panel hero" data-testid="admin-profile">
          <div><span className="eyebrow">PERFIL DEL DOCENTE-ADMINISTRADOR</span><h2>{labelOrPending(profile.full_name)}</h2><p>La identidad, la institución y los permisos se validan de forma segura en el servidor.</p>
            <dl className="profile-grid"><div><dt>Institución</dt><dd data-testid="admin-institution">{labelOrPending(profile.institution)}</dd></div><div><dt>Rol</dt><dd data-testid="admin-role">{profile.role}</dd></div><div><dt>Estado de cuenta</dt><dd>{labelOrPending(profile.account_status, "No configurado")}</dd></div><div><dt>Último acceso</dt><dd>{profile.last_access_at ? new Date(profile.last_access_at).toLocaleString("es-CO") : "Sin datos"}</dd></div></dl>
          </div>
          <div className="metric-placeholder"><span>Grupos asignados como docente</span><strong>{profile.assigned_groups.length}</strong><small>{profile.assigned_groups.length ? profile.assigned_groups.map((group) => group.name).join(", ") : "Sin datos"}</small></div>
        </section>
        <div className="metric-grid" data-testid="admin-dashboard">
          <Metric label="Grupos activos" value={dashboard.groups_total} /><Metric label="Estudiantes activos" value={dashboard.students_active} /><Metric label="Pendientes de activación" value={dashboard.students_pending_activation} /><Metric label="Learning Units" value={dashboard.learning_units_total} /><Metric label="Learning Units activas" value={dashboard.learning_units_active} /><Metric label="Learning Units archivadas" value={dashboard.learning_units_archived} /><Metric label="Rutas" value={dashboard.routes_total} /><Metric label="Estado" value={dashboard.system_status === "staging_ready" ? "Backend listo" : dashboard.system_status} pending="Pendiente" />
        </div>
      </> : null}

      {tab === "grupos" ? <section className="admin-workspace" data-testid="admin-groups-module">
        <form className="panel admin-editor" onSubmit={editingGroup ? saveGroup : createGroup}>
          <div className="section-heading"><div><span className="eyebrow">GESTIÓN DE GRUPOS</span><h2>{editingGroup ? "Editar grupo" : "Crear grupo"}</h2></div>{editingGroup ? <button className="icon-button" type="button" onClick={() => setEditingGroup(null)}><X size={18} /></button> : null}</div>
          <div className="form-grid"><label>Nombre<input value={editingGroup?.name ?? groupName} onChange={(event) => editingGroup ? setEditingGroup({ ...editingGroup, name: event.target.value }) : setGroupName(event.target.value)} required /></label><label>Grado<input value={editingGroup?.grade ?? groupGrade} onChange={(event) => editingGroup ? setEditingGroup({ ...editingGroup, grade: event.target.value }) : setGroupGrade(event.target.value)} placeholder="6, 7, 8…" /></label></div>
          <button className="primary-button" type="submit"><Save size={17} /> {editingGroup ? "Guardar cambios" : "Crear grupo"}</button>
        </form>
        <div className="admin-card-grid">{groups.map((group) => <article className="panel management-card" key={group.id}><div className="management-card-head"><div><h3>{group.name}</h3><p>{group.grade ? `Grado ${group.grade}` : "Grado no configurado"}</p></div><StatusPill status={group.archived_at ? "archived" : group.status} /></div><div className="management-metrics"><span><strong>{group.students}</strong> estudiantes</span><span>{group.academic_year ?? "Año sin configurar"}</span></div><div className="management-actions">{group.archived_at ? <button className="secondary-button" onClick={() => void setGroupArchived(group, false)}><RotateCcw size={16} /> Restaurar</button> : <><button className="secondary-button" onClick={() => setEditingGroup(group)}><Pencil size={16} /> Editar</button><button className="danger-button" onClick={() => void setGroupArchived(group, true)}><Archive size={16} /> Archivar</button></>}</div></article>)}</div>
      </section> : null}

      {tab === "estudiantes" ? <section className="admin-workspace" data-testid="admin-students-module">
        {temporaryAccess ? <div className="panel temporary-access"><div><span className="eyebrow">CONTRASEÑA TEMPORAL · MOSTRAR UNA VEZ</span><h3>{temporaryAccess.name}</h3><code>{temporaryAccess.password}</code><p>Entréguela únicamente al estudiante correspondiente. La contraseña anterior ya no funciona.</p></div><button className="secondary-button" onClick={() => void navigator.clipboard.writeText(temporaryAccess.password)}><ClipboardCopy size={16} /> Copiar</button></div> : null}
        <form className="panel admin-toolbar" onSubmit={(event) => { event.preventDefault(); void loadStudents(studentSearch, studentGroupFilter); }}><label className="search-field"><Search size={17} /><input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Buscar estudiante" /></label><select value={studentGroupFilter} onChange={(event) => setStudentGroupFilter(event.target.value)}><option value="">Todos los grupos</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button className="secondary-button" type="submit">Buscar</button></form>
        <div className="admin-list">{students.map((student) => <article className="panel student-row" key={student.user_id}><div className="student-main"><div className="avatar-small"><UserRound size={18} /></div><div><h3>{student.full_name ?? "Sin nombre"}</h3><p>{student.grade ? `Grado ${student.grade}` : "Grado pendiente"} · {student.group_name ?? "Sin grupo"} · {student.email ?? "Sin correo"}</p><div className="inline-stats"><span>Dominadas <strong>{student.mastered}</strong></span><span>Aprendizaje <strong>{student.learning}</strong></span><span>Revisión <strong>{student.review}</strong></span><span>XP <strong>{student.xp}</strong></span></div></div></div><div className="student-side"><StatusPill status={student.status} /><small>{student.last_sign_in_at ? `Último acceso ${new Date(student.last_sign_in_at).toLocaleDateString("es-CO")}` : "Sin ingreso registrado"}</small><div className="student-group-control"><select value={studentGroupChoice[student.user_id] ?? student.group_id ?? ""} onChange={(event) => setStudentGroupChoice((previous) => ({ ...previous, [student.user_id]: event.target.value }))}><option value="">Seleccionar grupo</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><button className="secondary-button compact" onClick={() => void assignStudentGroup(student)}>Mover</button></div><div className="management-actions"><button className="secondary-button" onClick={() => void resetStudentAccess(student)}><KeyRound size={16} /> Regenerar acceso</button>{student.status === "active" ? <button className="secondary-button" onClick={() => void changeStudentStatus(student, "suspended")}>Suspender</button> : <button className="secondary-button" onClick={() => void changeStudentStatus(student, "active")}><RotateCcw size={16} /> Reactivar</button>}<button className="danger-button" onClick={() => void changeStudentStatus(student, "archived")}><Archive size={16} /> Archivar</button></div></div></article>)}</div>
      </section> : null}

      {tab === "vocabulario" ? <section className="admin-workspace" data-testid="admin-vocabulary-module">
        <form className="panel admin-editor" onSubmit={saveVocabulary}><div className="section-heading"><div><span className="eyebrow">CATÁLOGO ÚNICO</span><h2>{vocabForm.id ? "Editar Learning Unit" : "Agregar Learning Unit"}</h2></div>{vocabForm.id ? <button type="button" className="icon-button" onClick={() => setVocabForm(emptyVocabularyForm)}><X size={18} /></button> : null}</div><div className="form-grid three"><label>Inglés<input value={vocabForm.english} onChange={(event) => setVocabForm({ ...vocabForm, english: event.target.value })} required /></label><label>Español<input value={vocabForm.spanish} onChange={(event) => setVocabForm({ ...vocabForm, spanish: event.target.value })} required /></label><label>Tipo<select value={vocabForm.unit_type} onChange={(event) => setVocabForm({ ...vocabForm, unit_type: event.target.value })}><option value="word">word</option><option value="chunk">chunk</option><option value="phrasal_verb">phrasal_verb</option><option value="expression">expression</option><option value="command">command</option></select></label><label>Formas aceptadas<input value={vocabForm.accepted_forms} onChange={(event) => setVocabForm({ ...vocabForm, accepted_forms: event.target.value })} placeholder="forma 1, forma 2" /></label><label>Categoría<input value={vocabForm.category} onChange={(event) => setVocabForm({ ...vocabForm, category: event.target.value })} /></label><label>Dificultad<input type="number" min={1} max={5} value={vocabForm.difficulty} onChange={(event) => setVocabForm({ ...vocabForm, difficulty: Number(event.target.value) })} /></label><label>Ejemplo inglés<input value={vocabForm.example_en} onChange={(event) => setVocabForm({ ...vocabForm, example_en: event.target.value })} /></label><label>Ejemplo español<input value={vocabForm.example_es} onChange={(event) => setVocabForm({ ...vocabForm, example_es: event.target.value })} /></label><label>Prioridad<input type="number" min={1} value={vocabForm.priority} onChange={(event) => setVocabForm({ ...vocabForm, priority: Number(event.target.value) })} /></label></div><button className="primary-button" type="submit"><Plus size={17} /> {vocabForm.id ? "Guardar Learning Unit" : "Agregar al catálogo"}</button></form>
        <form className="panel admin-toolbar" onSubmit={(event) => { event.preventDefault(); void loadVocabulary(vocabSearch, vocabStatus); }}><label className="search-field"><Search size={17} /><input value={vocabSearch} onChange={(event) => setVocabSearch(event.target.value)} placeholder="Buscar en inglés o español" /></label><select value={vocabStatus} onChange={(event) => setVocabStatus(event.target.value)}><option value="">Todos los estados</option><option value="active">Activas</option><option value="archived">Archivadas</option><option value="unpublished">No publicadas</option></select><button className="secondary-button" type="submit">Filtrar</button><span className="toolbar-count">{vocabulary.total} Learning Units</span></form>
        <div className="vocabulary-table panel"><div className="table-head"><span>Learning Unit</span><span>Tipo / categoría</span><span>Uso</span><span>Estado</span><span>Acciones</span></div>{vocabulary.items.map((item) => <div className="table-row" key={item.id}><div><strong>{item.english}</strong><small>{item.spanish}</small><small>{item.unit_code}</small></div><div><span>{item.unit_type}</span><small>{item.category}</small></div><div><span>{item.lesson_refs} lecciones</span><small>{item.attempt_refs} intentos · {item.progress_refs} progresos</small></div><div><StatusPill status={item.status} /></div><div className="table-actions"><button title="Editar" className="icon-button" onClick={() => editVocabulary(item)}><Pencil size={16} /></button>{item.status === "archived" ? <button title="Restaurar" className="icon-button" onClick={() => void setVocabularyArchived(item, false)}><RotateCcw size={16} /></button> : <button title="Archivar" className="icon-button" onClick={() => void setVocabularyArchived(item, true)}><Archive size={16} /></button>}<button title="Eliminar si nunca se usó" className="icon-button danger-icon" disabled={item.lesson_refs + item.attempt_refs + item.progress_refs > 0} onClick={() => void deleteUnusedVocabulary(item)}><Trash2 size={16} /></button></div></div>)}</div>
      </section> : null}

      {tab === "auditoria" ? <section className="admin-workspace" data-testid="admin-audit-module"><div className="panel audit-panel"><div className="section-heading"><div><span className="eyebrow">TRAZABILIDAD</span><h2>Acciones administrativas</h2></div></div>{audit.length === 0 ? <p className="muted-copy">Sin eventos registrados.</p> : <div className="audit-list">{audit.map((event) => <article key={event.id}><div><strong>{event.action}</strong><span>{event.target_type}</span></div><small>{new Date(event.created_at).toLocaleString("es-CO")}</small></article>)}</div>}</div></section> : null}

      <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
    </main>
  </div>;
}
