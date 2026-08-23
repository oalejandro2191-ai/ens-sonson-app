"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Archive, ArrowLeft, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, X } from "lucide-react";
import { getBrowserSupabase } from "../lib/supabase-browser";

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

type VocabularyResult = {
  total: number;
  limit: number;
  offset: number;
  items: VocabularyItem[];
};

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

const PAGE_SIZE = 100;
const emptyForm: VocabularyForm = {
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

function Status({ value }: { value: string }) {
  return <span className={`status-pill ${value}`}>{value}</span>;
}

export default function AdminVocabularyCatalog() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [institution, setInstitution] = useState<string | null>(null);
  const [result, setResult] = useState<VocabularyResult>({ total: 0, limit: PAGE_SIZE, offset: 0, items: [] });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState<VocabularyForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadPage = useCallback(async (nextOffset: number, nextSearch = search, nextStatus = status) => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const response = await supabase.rpc("get_admin_vocabulary_v1", {
        provided_search: nextSearch.trim() || null,
        provided_status: nextStatus || null,
        provided_limit: PAGE_SIZE,
        provided_offset: Math.max(0, nextOffset),
      });
      if (response.error) throw response.error;
      const data = (response.data ?? { total: 0, limit: PAGE_SIZE, offset: nextOffset, items: [] }) as VocabularyResult;
      setResult(data);
      setOffset(data.offset ?? Math.max(0, nextOffset));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No fue posible cargar el catálogo.");
    } finally {
      setBusy(false);
    }
  }, [search, status, supabase]);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    const run = async () => {
      const session = await supabase.auth.getSession();
      if (!session.data.session) { setReady(true); return; }
      const portal = await supabase.rpc("get_my_admin_portal_v1");
      if (portal.error) { setReady(true); return; }
      setAuthorized(true);
      setInstitution((portal.data as { profile?: { institution?: string | null } })?.profile?.institution ?? null);
      await loadPage(0, "", "");
      setReady(true);
    };
    void run();
  }, [loadPage, supabase]);

  function edit(item: VocabularyItem) {
    setForm({
      id: item.id,
      english: item.english,
      spanish: item.spanish,
      unit_type: item.unit_type,
      accepted_forms: Array.isArray(item.accepted_forms) ? item.accepted_forms.join(", ") : "",
      category: item.category,
      difficulty: item.difficulty,
      example_en: item.example_en ?? "",
      example_es: item.example_es ?? "",
      priority: item.priority,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const common = {
      provided_english: form.english,
      provided_spanish: form.spanish,
      provided_unit_type: form.unit_type,
      provided_accepted_forms: form.accepted_forms.split(",").map((value) => value.trim()).filter(Boolean),
      provided_category: form.category,
      provided_difficulty: form.difficulty,
      provided_example_en: form.example_en || null,
      provided_example_es: form.example_es || null,
      provided_priority: form.priority,
    };
    const response = form.id
      ? await supabase.rpc("admin_update_vocabulary_word_v1", { target_word_id: form.id, ...common })
      : await supabase.rpc("admin_create_vocabulary_word_v1", common);
    if (response.error) {
      setError(response.error.message);
      setBusy(false);
      return;
    }
    setNotice(form.id ? "Learning Unit actualizada." : "Learning Unit agregada al catálogo.");
    setForm(emptyForm);
    await loadPage(offset);
    setBusy(false);
  }

  async function setArchived(item: VocabularyItem, archive: boolean) {
    if (!supabase) return;
    setError(null);
    setNotice(null);
    const response = await supabase.rpc(
      archive ? "admin_archive_vocabulary_word_v1" : "admin_restore_vocabulary_word_v1",
      { target_word_id: item.id },
    );
    if (response.error) { setError(response.error.message); return; }
    setNotice(archive ? "Learning Unit archivada sin borrar su historial." : "Learning Unit restaurada.");
    await loadPage(offset);
  }

  async function removeUnused(item: VocabularyItem) {
    if (!supabase) return;
    if (!window.confirm(`¿Eliminar definitivamente “${item.english}”? Solo será posible si nunca tuvo uso académico.`)) return;
    const response = await supabase.rpc("admin_delete_unused_vocabulary_word_v1", { target_word_id: item.id });
    if (response.error) { setError(response.error.message); return; }
    setNotice("Learning Unit sin historial eliminada definitivamente.");
    const nextOffset = result.items.length === 1 && offset > 0 ? Math.max(0, offset - PAGE_SIZE) : offset;
    await loadPage(nextOffset);
  }

  if (!ready) return <main className="loading-page"><RefreshCw className="spin" size={18} /> Cargando catálogo…</main>;
  if (!supabase) return <main className="loading-page">Supabase no configurado.</main>;
  if (!authorized) return <main className="login-page"><section className="panel empty-state"><h2>Acceso administrativo requerido</h2><p>Inicie sesión con una cuenta institution_admin para administrar el catálogo.</p><Link className="primary-button" href="/admin">Ir al acceso administrativo</Link></section></main>;

  const pageNumber = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const first = result.total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + result.items.length, result.total);

  return <main className="main-content" data-testid="admin-vocabulary-catalog">
    <header className="topbar">
      <div><span className="eyebrow">ENS ENGLISH · ADMINISTRACIÓN</span><h1>Catálogo completo de vocabulario</h1><p>{institution ?? "Institución"}</p></div>
      <Link className="secondary-button" href="/admin"><ArrowLeft size={17} /> Volver al panel</Link>
    </header>

    {error ? <div className="form-error admin-feedback">{error}</div> : null}
    {notice ? <div className="form-note admin-feedback">{notice}</div> : null}

    <section className="admin-workspace">
      <form className="panel admin-editor" onSubmit={save}>
        <div className="section-heading"><div><span className="eyebrow">CATÁLOGO ÚNICO</span><h2>{form.id ? "Editar Learning Unit" : "Agregar Learning Unit"}</h2></div>{form.id ? <button type="button" className="icon-button" onClick={() => setForm(emptyForm)}><X size={18} /></button> : null}</div>
        <div className="form-grid three">
          <label>Inglés<input required value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} /></label>
          <label>Español<input required value={form.spanish} onChange={(e) => setForm({ ...form, spanish: e.target.value })} /></label>
          <label>Tipo<select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })}><option value="word">word</option><option value="chunk">chunk</option><option value="phrasal_verb">phrasal_verb</option><option value="expression">expression</option><option value="command">command</option></select></label>
          <label>Formas aceptadas<input value={form.accepted_forms} onChange={(e) => setForm({ ...form, accepted_forms: e.target.value })} placeholder="forma 1, forma 2" /></label>
          <label>Categoría<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></label>
          <label>Dificultad<input type="number" min={1} max={5} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })} /></label>
          <label>Ejemplo inglés<input value={form.example_en} onChange={(e) => setForm({ ...form, example_en: e.target.value })} /></label>
          <label>Ejemplo español<input value={form.example_es} onChange={(e) => setForm({ ...form, example_es: e.target.value })} /></label>
          <label>Prioridad<input type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></label>
        </div>
        <button className="primary-button" type="submit" disabled={busy}><Plus size={17} /> {form.id ? "Guardar Learning Unit" : "Agregar al catálogo"}</button>
      </form>

      <form className="panel admin-toolbar" onSubmit={(event) => { event.preventDefault(); void loadPage(0); }}>
        <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en inglés o español" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="active">Activas</option><option value="archived">Archivadas</option><option value="unpublished">No publicadas</option></select>
        <button className="secondary-button" type="submit">Filtrar</button>
        <span className="toolbar-count" data-testid="vocabulary-total">{result.total} Learning Units</span>
      </form>

      <div className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span data-testid="vocabulary-range">Mostrando {first}–{last} de {result.total}</span>
        <div className="management-actions">
          <button className="secondary-button" type="button" disabled={offset === 0 || busy} onClick={() => void loadPage(Math.max(0, offset - PAGE_SIZE))}><ChevronLeft size={16} /> Anterior</button>
          <strong data-testid="vocabulary-page">Página {pageNumber} de {pageCount}</strong>
          <button className="secondary-button" type="button" disabled={offset + PAGE_SIZE >= result.total || busy} onClick={() => void loadPage(offset + PAGE_SIZE)}>Siguiente <ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="vocabulary-table panel">
        <div className="table-head"><span>Learning Unit</span><span>Tipo / categoría</span><span>Uso</span><span>Estado</span><span>Acciones</span></div>
        {result.items.map((item) => {
          const used = item.lesson_refs + item.attempt_refs + item.progress_refs > 0;
          return <div className="table-row" key={item.id}>
            <div><strong>{item.english}</strong><small>{item.spanish}</small><small>{item.unit_code}</small></div>
            <div><span>{item.unit_type}</span><small>{item.category}</small></div>
            <div><span>{item.lesson_refs} lecciones</span><small>{item.attempt_refs} intentos · {item.progress_refs} progresos</small></div>
            <div><Status value={item.status} /></div>
            <div className="table-actions">
              <button title="Editar" className="icon-button" type="button" onClick={() => edit(item)}><Pencil size={16} /></button>
              {item.status === "archived"
                ? <button title="Restaurar" className="icon-button" type="button" onClick={() => void setArchived(item, false)}><RotateCcw size={16} /></button>
                : <button title="Archivar" className="icon-button" type="button" onClick={() => void setArchived(item, true)}><Archive size={16} /></button>}
              <button title={used ? "No puede eliminarse: tiene historial" : "Eliminar si nunca se usó"} className="icon-button" type="button" disabled={used} onClick={() => void removeUnused(item)}><Trash2 size={16} /></button>
            </div>
          </div>;
        })}
        {result.items.length === 0 ? <div className="empty-state"><p>No hay Learning Units para este filtro.</p></div> : null}
      </div>
    </section>
  </main>;
}
