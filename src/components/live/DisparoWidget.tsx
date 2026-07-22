"use client"

// ══════════════════════════════════════════════════════════════════
// DisparoWidget — indicador flutuante (canto inferior direito) que
// mostra o progresso dos envios em background do módulo Live.
// Lê o disparo.store (singleton) e sobrevive à troca de página.
// Montado uma única vez no layout do dashboard.
// ══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useQueryClient } from "@tanstack/react-query"
import { Send, Radio, ShieldCheck, X, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, Ban, Minus, RefreshCw } from "lucide-react"
import { useDisparoStore } from "@/stores/disparo.store"

const LABEL: Record<string, string> = {
  disparo:      "Disparando mensagens",
  aviso:        "Avisando clientes",
  consentimento:"Enviando consentimentos",
  "google-sync":"Sincronizando Google Contatos",
}

const COR: Record<string, string> = {
  disparo:      "#25d366",
  aviso:        "#10b981",
  consentimento:"#7c3aed",
  "google-sync":"#4285F4",
}

const ICONE: Record<string, typeof Send> = {
  disparo:      Send,
  aviso:        Radio,
  consentimento:ShieldCheck,
  "google-sync":RefreshCw,
}

export default function DisparoWidget() {
  const job              = useDisparoStore((s) => s.job)
  const minimized        = useDisparoStore((s) => s.minimized)
  const jobSalvo         = useDisparoStore((s) => s.jobSalvo)
  const setMinimized     = useDisparoStore((s) => s.setMinimized)
  const cancelar         = useDisparoStore((s) => s.cancelar)
  const dispensar        = useDisparoStore((s) => s.dispensar)
  const retomar          = useDisparoStore((s) => s.retomar)
  const descartarJobSalvo = useDisparoStore((s) => s.descartarJobSalvo)

  const qc = useQueryClient()
  const [detalhes, setDetalhes] = useState(false)
  const jaInvalidou = useRef<string | null>(null)

  // Quando um job termina, atualiza as queries afetadas
  useEffect(() => {
    if (!job || job.status === "running") return
    if (jaInvalidou.current === job.id) return
    jaInvalidou.current = job.id
    if (job.tipo === "consentimento" || job.tipo === "google-sync") {
      qc.invalidateQueries({ queryKey: ["clientes"] })
      qc.invalidateQueries({ queryKey: ["google-sync-preview"] })
    } else {
      qc.invalidateQueries({ queryKey: ["lives"] })
      if (job.liveId != null) qc.invalidateQueries({ queryKey: ["live-detalhe", job.liveId] })
    }
  }, [job, qc])

  // ── Nada a mostrar ──
  if (!job && !jobSalvo) return null

  // ── Prompt de retomada (job interrompido detectado) ──
  if (!job && jobSalvo) {
    const cor    = COR[jobSalvo.tipo]   ?? "#10b981"
    const Icone  = ICONE[jobSalvo.tipo] ?? Send
    const label  = LABEL[jobSalvo.tipo] ?? "Envio"
    const subtitulo =
      jobSalvo.tipo === "disparo"      ? jobSalvo.liveTitulo :
      jobSalvo.tipo === "aviso"        ? jobSalvo.liveTitulo :
      jobSalvo.tipo === "google-sync"  ? `${jobSalvo.clienteIds.length} cliente(s)` :
      "Clientes sem consentimento"

    return (
      <AnimatePresence>
        <motion.div
          key="resume-prompt"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          className="fixed bottom-4 right-4 z-[9999] w-[300px] rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: "var(--bg-surface)", border: `1px solid ${cor}44` }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: "1px solid var(--border)", background: "rgba(245,158,11,0.08)" }}>
            <AlertTriangle size={14} style={{ color: "#f59e0b" }} />
            <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Envio interrompido</p>
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <Icone size={14} style={{ color: cor }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</p>
                {subtitulo && (
                  <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{subtitulo}</p>
                )}
              </div>
            </div>

            <p className="text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
              O envio foi interrompido. Retomar vai continuar de onde parou — sem reenviar para quem já recebeu.
            </p>

            <div className="flex gap-2">
              <button
                onClick={retomar}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5"
                style={{ background: cor }}>
                <RefreshCw size={12} /> Retomar envio
              </button>
              <button
                onClick={descartarJobSalvo}
                title="Descartar"
                className="px-3 py-2 rounded-xl border inline-flex items-center justify-center"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-base)" }}>
                <X size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  if (!job) return null

  const running  = job.status === "running"
  const pct      = job.total > 0 ? Math.round((job.atual / job.total) * 100) : 0
  const cor      = COR[job.tipo]   ?? "#10b981"
  const Icone    = ICONE[job.tipo] ?? Send
  const errosLista = job.resultados.filter((r) => r.status === "erro")

  // ── Minimizado: pílula compacta ──
  if (minimized) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-3 py-2 rounded-full shadow-lg"
        style={{ background: "var(--bg-surface)", border: `1px solid ${cor}55` }}>
        <motion.span animate={running ? { scale: [1, 1.2, 1] } : {}} transition={{ repeat: Infinity, duration: 1.4 }}>
          <Icone size={15} style={{ color: cor }} />
        </motion.span>
        <span className="text-xs font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
          {running ? `${job.atual}/${job.total}` : job.status === "done" ? "✓" : "!"}
        </span>
        <ChevronUp size={13} style={{ color: "var(--text-muted)" }} />
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
        className="fixed bottom-4 right-4 z-[9999] w-[320px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)", background: `${cor}0f` }}>
          <div className="flex items-center gap-2 min-w-0">
            <motion.span animate={running ? { rotate: [0, 8, -8, 0] } : {}} transition={{ repeat: Infinity, duration: 0.9 }}>
              <Icone size={16} style={{ color: cor }} />
            </motion.span>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{LABEL[job.tipo]}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>{job.liveTitulo}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setMinimized(true)} title="Minimizar" className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
              <Minus size={15} />
            </button>
            {!running && (
              <button onClick={dispensar} title="Fechar" className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* ── RODANDO ── */}
          {running && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {job.atual} <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>de {job.total}</span>
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: cor }}>{pct}%</span>
              </div>

              {/* Barra de progresso */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-base)" }}>
                <motion.div className="h-full rounded-full" style={{ background: cor }}
                  animate={{ width: `${pct}%` }} transition={{ ease: "easeOut", duration: 0.4 }} />
              </div>

              <p className="text-[11px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {job.aguardando > 0
                  ? <>⏳ Próxima em <b style={{ color: "var(--text-primary)" }}>{job.aguardando}s</b> → {job.nomeAtual}</>
                  : job.nomeAtual
                    ? <>✉️ Enviando para <b style={{ color: "var(--text-primary)" }}>{job.nomeAtual}</b>…</>
                    : "Preparando fila…"}
              </p>

              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Roda em segundo plano com intervalo seguro. Pode usar o sistema normalmente.
              </p>

              <button onClick={cancelar}
                className="w-full py-2 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 border"
                style={{ borderColor: "var(--border)", color: "#f87171", background: "var(--bg-base)" }}>
                <Ban size={13} /> Parar envio
              </button>
            </>
          )}

          {/* ── TERMINADO / CANCELADO / ERRO ── */}
          {!running && (
            <>
              {job.status === "done" && job.total === 0 && (
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {job.erroFatal ?? "Nenhum item pendente para enviar."}
                </p>
              )}

              {job.status === "error" && (
                <div className="flex items-start gap-2 text-xs" style={{ color: "#f87171" }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>{job.erroFatal ?? "Falha ao processar o envio."}</span>
                </div>
              )}

              {(job.status === "done" && job.total > 0) || job.status === "cancelled" ? (
                <>
                  <div className="flex items-center gap-2">
                    {job.status === "cancelled"
                      ? <Ban size={16} style={{ color: "#f59e0b" }} />
                      : <CheckCircle2 size={16} style={{ color: "#10b981" }} />}
                    <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                      {job.status === "cancelled" ? "Envio interrompido" : "Envio concluído"}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded-lg font-semibold" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                      {job.enviadas} {job.tipo === "google-sync" ? "sincronizado" + (job.enviadas !== 1 ? "s" : "") : "enviada" + (job.enviadas !== 1 ? "s" : "")}
                    </span>
                    {job.erros > 0 && (
                      <span className="px-2 py-1 rounded-lg font-semibold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                        {job.erros} erro{job.erros !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {errosLista.length > 0 && (
                    <div>
                      <button onClick={() => setDetalhes((v) => !v)}
                        className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        {detalhes ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Ver falhas
                      </button>
                      {detalhes && (
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {errosLista.map((r) => (
                            <div key={r.id} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--bg-base)" }}>
                              <b style={{ color: "var(--text-primary)" }}>{r.nome}</b>
                              {r.detalhe && <span style={{ color: "var(--text-muted)" }}> — {r.detalhe}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              <button onClick={dispensar}
                className="w-full py-2 rounded-xl text-xs font-bold text-white"
                style={{ background: cor }}>
                Fechar
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
