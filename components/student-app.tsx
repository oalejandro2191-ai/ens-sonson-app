"use client";

import Link from "next/link";
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Gamepad2,
  GraduationCap,
  Home,
  UserRound,
  UsersRound,
} from "lucide-react";
import { resolveStudentSection, type StudentSection } from "@/lib/navigation";
import { stagingCapabilities } from "@/features/student/staging-status";

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

function PendingPanel({ title }: { title: string }) {
  return (
    <section className="panel empty-state" aria-labelledby="pending-title">
      <span className="eyebrow">STAGING SEGURO</span>
      <h2 id="pending-title">{title}</h2>
      <p>
        Este módulo todavía no publica datos académicos. Se habilitará cuando su fuente de verdad en
        Supabase, permisos y pruebas estén validados.
      </p>
    </section>
  );
}

export function StudentApp({ section }: { section: string[] }) {
  const active = resolveStudentSection(section);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <GraduationCap size={24} />
          </div>
          <div>
            <strong>ENS English</strong>
            <span>Staging</span>
          </div>
        </div>
        <nav aria-label="Navegación del estudiante">
          {navigation.map(({ key, label, icon: Icon }) => (
            <Link key={key} href={routeFor(key)} className={`nav-link ${active === key ? "active" : ""}`}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="staging-note">Entorno de estabilización · sin datos ficticios</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="eyebrow">ENS SONSÓN · INGLÉS</span>
            <h1>{navigation.find((item) => item.key === active)?.label ?? "Inicio"}</h1>
          </div>
          <div className="identity-chip" aria-label="Identidad pendiente de autenticación">
            <div className="initials">ENS</div>
            <div>
              <strong>Cuenta de prueba</strong>
              <span>Identidad pendiente de backend</span>
            </div>
          </div>
        </header>

        {active === "inicio" ? (
          <>
            <section className="hero panel">
              <div>
                <span className="eyebrow">BASE CANÓNICA · RELEASE CANDIDATE EN CONSTRUCCIÓN</span>
                <h2>Aprender primero. Medir después. Inventar datos, nunca.</h2>
                <p>
                  Esta versión elimina del flujo activo el progreso de demostración. Las palabras dominadas,
                  XP, rachas y rankings solo aparecerán cuando provengan del backend académico autorizado.
                </p>
              </div>
              <div className="metric-placeholder">
                <span>PALABRAS DOMINADAS</span>
                <strong>—</strong>
                <small>Sin dato hasta conectar Supabase Staging</small>
              </div>
            </section>

            <section className="capability-grid" aria-label="Estado de estabilización">
              {stagingCapabilities.map((item) => (
                <article className="panel capability-card" key={item.label}>
                  <span className={`status-dot ${item.state}`} aria-hidden="true" />
                  <h3>{item.label}</h3>
                  <p>{item.detail}</p>
                </article>
              ))}
            </section>
          </>
        ) : (
          <PendingPanel title={navigation.find((item) => item.key === active)?.label ?? "Módulo"} />
        )}

        <footer>Sistema creado por Oscar Alejandro Gil Valencia</footer>
      </main>
    </div>
  );
}
