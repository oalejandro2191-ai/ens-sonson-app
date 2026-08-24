"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type Dashboard = {
  display_alias: string | null;
  group: { id: string; name: string; grade: string | null; section: string | null; academic_year: string | null } | null;
  route: { code: string; lesson_count: number; completed: number; mastered: number; traversed_percentage: number; mastery_percentage: number };
  current_lesson: { id: string; position: number; title: string; purpose: string | null; state: string } | null;
  streak: number;
  xp: number;
  credits: number;
  due_review_words: number;
};

type RouteProgress = {
  route_code: string;
  lessons: Array<{
    lesson_id: string;
    position: number;
    status: string;
    mastery_status: string;
    last_percentage: number;
    best_percentage: number;
    can_open: boolean;
  }>;
};

type WordStates = { mastered: number; learning: number; review: number; new: number };

type LessonTask = {
  word_id: string;
  lesson_unit_position: number;
  activity_type: "association" | "listening" | "writing" | "recall";
  activity_position: number;
  english: string;
  spanish: string;
  example_en: string;
  example_es: string;
  audio_path: string | null;
};

type ConfirmedAttempt = {
  attempt_id: number;
  word_id: string;
  activity_type: LessonTask["activity_type"];
  client_event_id: string | null;
  correct: boolean;
  answered_at?: string;
};

type ActiveSession = {
  session_id: string;
  client_session_id: string;
  status: string;
  route_code: string;
  lesson: { id: string; title: string; purpose: string | null; unit_count: number };
  expected_count: number;
  confirmed_count: number;
  tasks: LessonTask[];
  attempts: ConfirmedAttempt[];
};

type LessonResult = {
  correct: number;
  total: number;
  percentage: number;
  mastered: boolean;
  xp: number;
  coins: number;
};

const routeCode = process.env.NEXT_PUBLIC_ENS_ROUTE_CODE ?? "A1-V3";

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

function studentInitials(name: string | null) {
  const parts = (name ?? "Estudiante").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "E";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function routeLevel(code: string | null | undefined) {
  return code?.split("-")[0] ?? "A1";
}

function taskKey(task: Pick<LessonTask, "word_id" | "activity_type">) {
  return `${task.word_id}:${task.activity_type}`;
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
        <div className="brand login-brand"><div className="brand-mark" aria-hidden="true"><GraduationCap size={26} /></div><div><strong>ENS English</strong><span>Escuela Normal Superior</span></div></div>
        <span className="eyebrow">ACCESO INSTITUCIONAL</span>
        <h1>Iniciar sesión</h1>
        <p>Ingresa con tu cuenta para continuar tu ruta de aprendizaje.</p>
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

function EmptyPanel({ title, detail = "Sin progreso registrado" }: { title: string; detail?: string }) {
  return <section className="panel empty-state"><span className="eyebrow">ENS ENGLISH</span><h2>{title}</h2><p>{detail}</p></section>;
}

function IdentityPanel({
  identity,
  dashboard = null,
  states = null,
}: {
  identity: IdentityView;
  dashboard?: Dashboard | null;
  states?: WordStates | null;
}) {
  const name = identity.portal.display_alias ?? "Estudiante";
  const level = routeLevel(dashboard?.route.code);
  const routePercent = dashboard?.route.traversed_percentage ?? null;
  const completedLessons = dashboard?.route.completed ?? null;
  const totalLessons = dashboard?.route.lesson_count ?? null;

  return (
    <div className="student-profile-page" data-testid="identity-panel">
      <section className="panel student-profile-hero">
        <div className="student-profile-avatar" aria-hidden="true">{studentInitials(name)}</div>
        <div className="student-profile-heading">
          <span className="eyebrow">MI PERFIL</span>
          <h2>{name}</h2>
          <p>{identity.grade ?? "Grado pendiente"}{identity.group ? ` · ${identity.group}` : ""}</p>
          <div className="student-profile-badges">
            <span>{roleLabel(identity.portal.institution_role)}</span>
            {dashboard ? <span>Ruta {level}</span> : null}
          </div>
        </div>
        {dashboard ? (
          <div className="student-profile-route">
            <div className="student-profile-route-head"><span>Avance de la ruta</span><strong>{routePercent}%</strong></div>
            <div className="student-profile-route-track" aria-label={`Ruta completada ${routePercent}%`}><span style={{ width: `${Math.max(0, Math.min(100, routePercent ?? 0))}%` }} /></div>
            <small>{completedLessons} de {totalLessons} lecciones completadas</small>
          </div>
        ) : null}
      </section>

      {dashboard ? (
        <section className="student-profile-metrics" aria-label="Resumen de progreso">
          <article className="panel student-profile-metric"><span className="profile-metric-icon">⚡</span><div><strong>{dashboard.xp}</strong><small>XP acumulado</small></div></article>
          <article className="panel student-profile-metric"><span className="profile-metric-icon">🪙</span><div><strong>{dashboard.credits}</strong><small>Monedas</small></div></article>
          <article className="panel student-profile-metric"><span className="profile-metric-icon">🔥</span><div><strong>{dashboard.streak}</strong><small>Días de racha</small></div></article>
          <article className="panel student-profile-metric"><span className="profile-metric-icon">📘</span><div><strong>{completedLessons}/{totalLessons}</strong><small>Lecciones</small></div></article>
        </section>
      ) : null}

      <section className="student-profile-columns">
        <article className="panel student-profile-card">
          <span className="eyebrow">MIS DATOS</span>
          <h3>Información académica</h3>
          <dl className="profile-grid student-profile-info-grid">
            <div><dt>Institución</dt><dd>{identity.institution ?? "No disponible"}</dd></div>
            <div><dt>Grado</dt><dd>{identity.grade ?? "Pendiente de asignación"}</dd></div>
            <div><dt>Grupo</dt><dd>{identity.group ?? "Pendiente de asignación"}</dd></div>
            <div><dt>Rol</dt><dd>{roleLabel(identity.portal.institution_role)}</dd></div>
          </dl>
        </article>

        {dashboard && states ? (
          <article className="panel student-profile-card student-learning-card">
            <span className="eyebrow">MI APRENDIZAJE</span>
            <h3>Vocabulario</h3>
            <div className="student-learning-summary">
              <div><strong>{states.mastered}</strong><span>Palabras dominadas</span></div>
              <div><strong>{states.learning}</strong><span>En aprendizaje</span></div>
              <div><strong>{states.review}</strong><span>En revisión</span></div>
              <div><strong>{dashboard.due_review_words}</strong><span>Por repasar</span></div>
            </div>
            <Link className="secondary-button student-profile-action" href="/estudiante/progreso">Ver mi progreso</Link>
          </article>
        ) : null}
      </section>
    </div>
  );
}

function DashboardPanel({ dashboard, states }: { dashboard: Dashboard; states: WordStates }) {
  return (
    <div data-testid="student-dashboard">
      <section className="hero panel">
        <div>
          <span className="eyebrow">TU PROGRESO</span>
          <h2>¡Hola, {dashboard.display_alias ?? "estudiante"}!</h2>
          <p>{dashboard.group ? `${dashboard.group.grade ?? "Grado pendiente"} · ${dashboard.group.name}` : "Continúa avanzando en tu ruta de inglés."}</p>
        </div>
        <div className="metric-placeholder"><span>PALABRAS DOMINADAS</span><strong data-testid="metric-mastered">{states.mastered}</strong><small>Lo que ya has consolidado</small></div>
      </section>
      <section className="metric-grid">
        <article className="panel metric-card"><span>En aprendizaje</span><strong data-testid="metric-learning">{states.learning}</strong></article>
        <article className="panel metric-card"><span>En revisión</span><strong data-testid="metric-review">{states.review}</strong></article>
        <article className="panel metric-card"><span>Por repasar</span><strong data-testid="metric-due">{dashboard.due_review_words}</strong></article>
        <article className="panel metric-card"><span>Ruta completada</span><strong>{dashboard.route.traversed_percentage}%</strong></article>
      </section>
      <section className="panel route-card">
        <div><span className="eyebrow">RUTA {routeLevel(dashboard.route.code)}</span><h3>{dashboard.current_lesson?.title ?? "Ruta al día"}</h3><p>{dashboard.current_lesson?.purpose ?? "No tienes una lección pendiente en este momento."}</p></div>
        {dashboard.current_lesson ? <Link className="primary-button" data-testid="continue-lesson" href="/estudiante/aprender">Continuar lección</Link> : null}
      </section>
      <section className="secondary-stats" aria-label="Datos motivacionales secundarios">
        <span>🔥 Racha: {dashboard.streak}</span><span>⚡ XP: {dashboard.xp}</span><span>🪙 Monedas: {dashboard.credits}</span>
      </section>
    </div>
  );
}

function ProgressPanel({ progress }: { progress: RouteProgress }) {
  return (
    <section className="panel progress-panel" data-testid="route-progress">
      <span className="eyebrow">PROGRESO DE RUTA {routeLevel(progress.route_code)}</span>
      <div className="lesson-list">
        {progress.lessons.length === 0 ? <p>Sin progreso registrado</p> : progress.lessons.map((lesson) => (
          <article key={lesson.lesson_id} className="lesson-row"><strong>Lección {lesson.position}</strong><span>{lesson.status}</span><span>{lesson.best_percentage}%</span></article>
        ))}
      </div>
    </section>
  );
}

function promptFor(task: LessonTask) {
  if (task.activity_type === "association") return `¿Qué significa “${task.english}”?`;
  if (task.activity_type === "listening") return `Escriba la palabra en inglés: ${task.spanish}`;
  if (task.activity_type === "writing") return `Escriba en inglés: ${task.spanish}`;
  return `Recuerde y escriba en inglés: ${task.spanish}`;
}

function LessonPanel({
  supabase,
  dashboard,
  onAcademicChange,
}: {
  supabase: SupabaseClient;
  dashboard: Dashboard;
  onAcademicChange: () => Promise<void>;
}) {
  const router = useRouter();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ correct: boolean; replay: boolean } | null>(null);
  const [omitted, setOmitted] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LessonResult | null>(null);

  const confirmed = useMemo(() => new Set((session?.attempts ?? []).map(taskKey)), [session]);
  const currentTask = session?.tasks.find((task) => !confirmed.has(taskKey(task)) && !omitted.has(taskKey(task))) ?? null;
  const pendingOmitted = session?.tasks.filter((task) => !confirmed.has(taskKey(task)) && omitted.has(taskKey(task))) ?? [];
  const allConfirmed = Boolean(session && confirmed.size === session.tasks.length);

  async function hydrateActive() {
    const active = await supabase.rpc("get_my_active_route_session_v1", { target_route_code: routeCode });
    if (active.error) throw active.error;
    setSession((active.data as ActiveSession | null) ?? null);
    return active.data as ActiveSession | null;
  }

  async function startOrRecover() {
    setError(null);
    setResult(null);
    try {
      const existing = await hydrateActive();
      if (existing) return;
      if (!dashboard.current_lesson) throw new Error("No hay una lección disponible para iniciar.");
      const clientSessionId = `web_${crypto.randomUUID().replaceAll("-", "")}`;
      const started = await supabase.rpc("start_route_lesson_session_v1", {
        target_route_code: routeCode,
        target_lesson_id: dashboard.current_lesson.id,
        provided_client_session_id: clientSessionId,
        provided_client_context: { client: "studentapp-local" },
      });
      if (started.error) throw started.error;
      await hydrateActive();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible iniciar la lección.");
    }
  }

  async function submitAnswer() {
    if (!session || !currentTask || sending) return;
    const eventId = `lesson:${session.session_id}:${currentTask.word_id}:${currentTask.activity_type}`;
    setSending(true);
    setError(null);
    setFeedback(null);
    const response = await supabase.rpc("record_route_lesson_attempt_v1", {
      target_session_id: session.session_id,
      target_word_id: currentTask.word_id,
      target_activity_type: currentTask.activity_type,
      provided_answer: answer,
      provided_response_time_ms: 1500,
      provided_client_event_id: eventId,
      provided_attempt_number: 1,
    });
    if (response.error) {
      setError(response.error.message);
      setSending(false);
      return;
    }
    const payload = response.data as { attempt_id: number; correct: boolean; idempotent_replay: boolean };
    setSession((previous) => previous ? {
      ...previous,
      confirmed_count: previous.attempts.some((item) => item.client_event_id === eventId) ? previous.confirmed_count : previous.confirmed_count + 1,
      attempts: previous.attempts.some((item) => item.client_event_id === eventId) ? previous.attempts : [...previous.attempts, {
        attempt_id: payload.attempt_id,
        word_id: currentTask.word_id,
        activity_type: currentTask.activity_type,
        client_event_id: eventId,
        correct: payload.correct,
      }],
    } : previous);
    setFeedback({ correct: payload.correct, replay: payload.idempotent_replay });
    setAnswer("");
    setSending(false);
  }

  function skipCurrent() {
    if (!currentTask) return;
    setOmitted((previous) => new Set(previous).add(taskKey(currentTask)));
    setAnswer("");
    setFeedback(null);
  }

  async function complete() {
    if (!session || !allConfirmed || sending) return;
    setSending(true);
    setError(null);
    const completed = await supabase.rpc("complete_route_lesson_session_v1", { target_session_id: session.session_id });
    if (completed.error) {
      setError(completed.error.message);
      setSending(false);
      return;
    }
    setResult(completed.data as LessonResult);
    setSession(null);
    setOmitted(new Set());
    await onAcademicChange();
    setSending(false);
  }

  if (result) {
    return <section className="panel lesson-result" data-testid="lesson-result"><span className="eyebrow">RESULTADO</span><h2>{result.correct}/{result.total}</h2><p>{result.percentage}% · {result.mastered ? "Lección dominada" : "Necesita repaso"}</p><button className="primary-button" type="button" onClick={() => router.push("/estudiante")}>Volver al inicio</button></section>;
  }

  if (!session) {
    return <section className="panel lesson-start" data-testid="lesson-start"><span className="eyebrow">SIGUIENTE LECCIÓN</span><h2>{dashboard.current_lesson?.title ?? "Sin lección pendiente"}</h2><p>{dashboard.current_lesson?.purpose ?? "Continúa tu ruta de aprendizaje a tu ritmo."}</p>{error ? <div className="form-error">{error}</div> : null}{dashboard.current_lesson ? <button data-testid="start-lesson" className="primary-button" type="button" onClick={startOrRecover}>Comenzar lección</button> : null}</section>;
  }

  if (allConfirmed) {
    return <section className="panel lesson-finish" data-testid="lesson-finish"><span className="eyebrow">LECCIÓN COMPLETADA</span><h2>¡Listo para finalizar!</h2><p>Completaste {session.confirmed_count} de {session.expected_count} actividades.</p><button data-testid="complete-lesson" className="primary-button" type="button" disabled={sending} onClick={complete}>{sending ? "Finalizando…" : "Finalizar lección"}</button><button data-testid="exit-lesson" className="secondary-button" type="button" onClick={() => router.push("/estudiante")}>Salir sin finalizar</button></section>;
  }

  if (!currentTask && pendingOmitted.length > 0) {
    return <section className="panel lesson-finish"><span className="eyebrow">TE QUEDAN ACTIVIDADES</span><h2>Aún no has terminado</h2><p>Tienes {pendingOmitted.length} {pendingOmitted.length === 1 ? "actividad pendiente" : "actividades pendientes"}. Puedes retomarlas para completar la lección.</p><button className="primary-button" type="button" onClick={() => setOmitted(new Set())}>Retomar actividades</button><button data-testid="exit-lesson" className="secondary-button" type="button" onClick={() => router.push("/estudiante")}>Salir</button></section>;
  }

  if (!currentTask) return <EmptyPanel title="No hay actividad disponible" />;

  return (
    <section className="panel practice-card" data-testid="practice-card">
      <div className="practice-meta"><span>Lección: {session.lesson.title}</span><span>{session.confirmed_count + 1}/{session.expected_count}</span></div>
      <span className="eyebrow">{currentTask.activity_type.toUpperCase()}</span>
      <h2>{promptFor(currentTask)}</h2>
      <p className="example-line">{currentTask.example_en}</p>
      <input data-testid="lesson-answer" className="answer-input" value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={sending} placeholder="Escriba su respuesta" />
      {feedback ? <div className={`server-feedback ${feedback.correct ? "correct" : "incorrect"}`}>{feedback.correct ? "Correcto" : "Incorrecto"}{feedback.replay ? " · respuesta recuperada" : ""}</div> : null}
      {error ? <div className="form-error">{error}</div> : null}
      <div className="practice-actions">
        <button data-testid="submit-answer" className="primary-button" type="button" disabled={sending || answer.trim().length === 0} onClick={submitAnswer}>{sending ? "Validando…" : "Responder"}</button>
        <button data-testid="skip-activity" className="secondary-button" type="button" disabled={sending} onClick={skipCurrent}>Omitir</button>
        <button data-testid="exit-lesson" className="secondary-button" type="button" disabled={sending} onClick={() => router.push("/estudiante")}>Salir</button>
      </div>
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
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [routeProgress, setRouteProgress] = useState<RouteProgress | null>(null);
  const [wordStates, setWordStates] = useState<WordStates>({ mastered: 0, learning: 0, review: 0, new: 0 });
  const [error, setError] = useState<string | null>(null);

  const loadStudentData = useCallback(async () => {
    if (!supabase) return;
    const [dashboardResult, routeResult, wordResult] = await Promise.all([
      supabase.rpc("get_my_learning_dashboard_v1", { target_route_code: routeCode }),
      supabase.rpc("get_my_route_progress_v1", { target_route_code: routeCode }),
      supabase.from("student_word_progress").select("mastery_state"),
    ]);
    if (dashboardResult.error || routeResult.error || wordResult.error) {
      throw dashboardResult.error ?? routeResult.error ?? wordResult.error ?? new Error("No se pudo cargar el progreso.");
    }
    const states: WordStates = { mastered: 0, learning: 0, review: 0, new: 0 };
    for (const row of wordResult.data ?? []) {
      const state = String((row as { mastery_state: string }).mastery_state) as keyof WordStates;
      if (state in states) states[state] += 1;
    }
    setDashboard(dashboardResult.data as Dashboard);
    setRouteProgress(routeResult.data as RouteProgress);
    setWordStates(states);
  }, [supabase]);

  const loadIdentity = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const hasSession = Boolean(sessionData.session);
    setSignedIn(hasSession);
    if (!hasSession) {
      setIdentity(null);
      setDashboard(null);
      setRouteProgress(null);
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
    if (portal.institution_role === "student") {
      try { await loadStudentData(); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo cargar el progreso."); }
    } else {
      setDashboard(null);
      setRouteProgress(null);
    }
    setLoading(false);
    setReady(true);
  }, [loadStudentData, supabase]);

  useEffect(() => {
    if (!supabase) return;
    const initialTimer = window.setTimeout(() => { void loadIdentity(); }, 0);
    const { data } = supabase.auth.onAuthStateChange(() => { window.setTimeout(() => { void loadIdentity(); }, 0); });
    return () => { window.clearTimeout(initialTimer); data.subscription.unsubscribe(); };
  }, [loadIdentity, supabase]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIdentity(null);
    setDashboard(null);
    setRouteProgress(null);
    setSignedIn(false);
  }

  if (!supabase) return <EmptyPanel title="Servicio de aprendizaje no disponible" detail="No fue posible conectar la aplicación en este momento." />;
  if (!ready) return <main className="loading-page"><RefreshCw className="spin" /> Cargando sesión…</main>;
  if (!signedIn) return <LoginPanel supabase={supabase} onSignedIn={loadIdentity} />;

  const isStudent = identity?.portal.institution_role === "student";
  const title = navigation.find((item) => item.key === active)?.label ?? "Inicio";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark" aria-hidden="true"><GraduationCap size={24} /></div><div><strong>ENS English</strong><span>English Lab</span></div></div>
        <nav aria-label="Navegación del estudiante">{navigation.map(({ key, label, icon: Icon }) => <Link key={key} href={routeFor(key)} className={`nav-link ${active === key ? "active" : ""}`}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}</nav>
        <div className="staging-note">Practica · aprende · avanza</div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><span className="eyebrow">ENS ENGLISH</span><h1>{title}</h1></div>
          {identity ? <div className="topbar-actions"><div className="identity-chip" data-testid="identity-chip"><div className="initials">{studentInitials(identity.portal.display_alias)}</div><div><strong>{identity.portal.display_alias ?? "No disponible"}</strong><span>{roleLabel(identity.portal.institution_role)}</span></div></div><button data-testid="logout" className="icon-button" type="button" aria-label="Cerrar sesión" onClick={signOut}><LogOut size={19} /></button></div> : null}
        </header>
        {error ? <div className="form-error page-error" role="alert">{error}</div> : null}
        {loading && identity ? <div className="sync-note"><RefreshCw className="spin" size={14} /> Actualizando…</div> : null}

        {!isStudent && identity ? <div data-testid="role-home"><IdentityPanel identity={identity} /><EmptyPanel title="Acceso académico de estudiante no habilitado" detail="Este rol puede autenticarse, pero no puede iniciar lecciones como estudiante." /></div> : null}
        {isStudent && identity && active === "inicio" && dashboard ? <DashboardPanel dashboard={dashboard} states={wordStates} /> : null}
        {isStudent && identity && active === "perfil" ? <IdentityPanel identity={identity} dashboard={dashboard} states={dashboard ? wordStates : null} /> : null}
        {isStudent && active === "progreso" && routeProgress ? <ProgressPanel progress={routeProgress} /> : null}
        {isStudent && active === "aprender" && dashboard ? <LessonPanel supabase={supabase} dashboard={dashboard} onAcademicChange={loadStudentData} /> : null}
        {isStudent && (active === "jugar" || active === "companeros") ? <EmptyPanel title={title} detail="Este espacio aún no tiene actividad disponible." /> : null}
        {isStudent && active === "inicio" && !dashboard && !loading ? <EmptyPanel title="Sin progreso registrado" /> : null}

        <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
      </main>
    </div>
  );
}