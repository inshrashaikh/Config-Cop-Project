import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/* ------------------------------------------------------------------ helpers */

const cx = (...v) => v.filter(Boolean).join(' ')

function Badge({ children, tone = 'slate', className = '' }) {
  const tones = {
    slate: 'bg-slate-800/80 text-slate-300 border-slate-700',
    emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/40',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/40',
    violet: 'bg-violet-500/10 text-violet-300 border-violet-500/40',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tones[tone], className)}>
      {children}
    </span>
  )
}

function Button({ children, onClick, tone = 'primary', disabled, busy, className = '' }) {
  const tones = {
    primary: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
    danger: 'bg-rose-500 hover:bg-rose-400 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
    ghost: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cx(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
        'disabled:cursor-not-allowed disabled:opacity-45',
        tones[tone],
        className,
      )}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

function Panel({ title, subtitle, children, className = '', right }) {
  return (
    <section className={cx('rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

const fmt = (v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))

/* ------------------------------------------------------------------ app */

export default function App() {
  const [status, setStatus] = useState(null)
  const [scan, setScan] = useState(null)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(null) // 'scan' | 'inject' | 'reset' | `fix:${name}` | `scale:${name}`
  const [toast, setToast] = useState(null)
  const [fixResults, setFixResults] = useState({})
  const [error, setError] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [aiStatus, setAiStatus] = useState(null)
  const [aiTesting, setAiTesting] = useState(false)
  const [selfHeal, setSelfHeal] = useState(null)
  const [pods, setPods] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [preview, setPreview] = useState({})

  const showToast = useCallback((msg, tone = 'ok') => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.status()
      setStatus(s)
      setError(null)
      return s
    } catch (e) {
      setError(`API unreachable: ${e.message}`)
      return null
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const loadAiStatus = useCallback(async (check = true) => {
    try { setAiStatus(await api.llmStatus(check)) } catch (e) { setAiStatus({ error: e.message }) }
  }, [])

  useEffect(() => { loadAiStatus(true) }, [loadAiStatus])

  const loadSelfHeal = useCallback(async () => {
    try { setSelfHeal(await api.selfHeal()) } catch { /* keep last */ }
  }, [])

  const loadPods = useCallback(async () => {
    try { setPods((await api.pods()).pods || []) } catch { /* keep last */ }
  }, [])

  useEffect(() => { loadSelfHeal(); loadPods() }, [loadSelfHeal, loadPods])

  // live auto-refresh: poll status/pods/self-heal so recovery is visible without clicking
  useEffect(() => {
    if (!autoRefresh) return undefined
    const id = setInterval(() => { loadStatus(); loadPods(); loadSelfHeal() }, 5000)
    return () => clearInterval(id)
  }, [autoRefresh, loadStatus, loadPods, loadSelfHeal])

  const workloads = status?.workloads || []
  const rollouts = useMemo(
    () => Object.fromEntries((status?.rollouts || []).map((r) => [r.workload, r])),
    [status],
  )

  const driftByName = useMemo(
    () => Object.fromEntries((scan?.drift || []).map((d) => [d.workload, d])),
    [scan],
  )
  const outlierByName = useMemo(
    () => Object.fromEntries(((scan?.outliers?.results) || []).map((o) => [o.workload, o])),
    [scan],
  )

  // selected workload defaults to first drifted, else first workload
  useEffect(() => {
    if (!workloads.length) return
    if (selected && workloads.some((w) => w.name === selected)) return
    const firstDrifted = (scan?.summary?.drifted || [])[0]
    setSelected(firstDrifted || workloads[0].name)
  }, [workloads, scan, selected])

  const drifted = scan?.summary?.drifted || []
  const selectedWl = workloads.find((w) => w.name === selected)
  const selectedDrift = driftByName[selected]
  const selectedExplanation = scan?.explanations?.[selected]
  const selectedMatches = scan?.matchedIncidents?.[selected] || []
  const selectedOutlier = outlierByName[selected]

  async function run(action, fn, okMsg) {
    setBusy(action)
    try {
      const res = await fn()
      if (okMsg) {
        const msg = typeof okMsg === 'function' ? await okMsg(res) : okMsg
        if (msg) showToast(msg)
      }
      return res
    } catch (e) {
      showToast(e.message, 'err')
      return null
    } finally {
      setBusy(null)
    }
  }

  const handleScan = () =>
    run('scan', api.scan, (r) =>
      r.summary.drifted.length
        ? `Scan complete — drift in ${r.summary.drifted.length} workload(s): ${r.summary.drifted.join(', ')}`
        : 'Scan complete — no drift, everything matches baseline')

  const handleInject = () =>
    run('inject', () => api.inject({}), async (r) => {
      const s = await loadStatus()
      if (s) setScan(null) // stale scan would mislead the demo
      const names = (r.injected || []).map((i) => i.workload).join(', ')
      const where = r.clusterMode === 'live' ? 'REAL cluster (kubectl patch)' : 'SIMULATED'
      if (r.errors?.length) return `Injected into ${names} on ${where}; ${r.errors.length} failed: ${r.errors[0].error}`
      return `Injected drift into ${names || 'workloads'} on ${where}`
    })

  const handleFix = (name) =>
    run(`fix:${name}`, () => api.fix(name), async (r) => {
      setFixResults((prev) => ({ ...prev, [name]: r }))
      // auto re-scan to prove resolution across the whole dashboard
      setBusy('scan')
      try {
        const s = await api.scan()
        setScan(s)
      } catch { /* fix already verified server-side */ }
      finally { setBusy(null) }
      await loadStatus()
      showToast(r.verified
        ? `${name} restored — fingerprint ${r.fingerprint} == baseline, re-scan clean`
        : `${name} fix verification FAILED`, r.verified ? 'ok' : 'err')
      return null
    })

  const handleScale = (name, delta) =>
    run(`scale:${name}`, () => api.scale(name, Math.max(0, (rollouts[name]?.desiredReplicas ?? 1) + delta)),
      (r) => `${r.workload} scaled to ${r.replicas} replica(s) — ${r.clusterMode === 'live' ? 'real kubectl rollout' : 'SIMULATED rollout started'}`)

  const handleReset = () =>
    run('reset', async () => { const r = await api.reset(); setScan(null); setFixResults({}); await loadStatus(); return r },
      (r) => r.clusterMode === 'live'
        ? 'Re-applied k8s/demo-workloads.yaml to the real cluster; baseline re-captured'
        : 'Demo state reset to pristine baseline (simulated)')

  const handleTestAi = () =>
    run('ai', async () => { const r = await api.llmTest(); await loadAiStatus(false); return r },
      (r) => r.ok ? `AI connected: ${r.provider}/${r.model} (${r.latencyMs}ms)` : `AI NOT connected — ${r.error}`)

  const handleCaptureBaseline = () =>
    run('baseline', async () => { const r = await api.captureBaseline(); await loadStatus(); return r },
      (r) => `Baseline captured: ${r.captured.join(', ')}`)

  const handleSelfHealToggle = () =>
    run('selfheal', async () => {
      const r = await api.setSelfHeal(!(selfHeal?.enabled), selfHeal?.interval)
      setSelfHeal(r)
      return r
    }, (r) => `Self-healing ${r.enabled ? 'ENABLED' : 'DISABLED'} — ${r.mode}`)

  const handleHealNow = () =>
    run('healnow', async () => {
      const r = await api.selfHealRun()
      setSelfHeal(r.status)
      await loadStatus(); loadPods()
      return r
    }, (r) => (r.healed?.length
      ? `Self-heal restored ${r.healed.length} workload(s): ${r.healed.join(', ')}`
      : (r.error ? `Self-heal error: ${r.error}` : 'Self-heal ran — no drift to fix')))

  const handleKillPod = (pod) =>
    run(`pod:${pod}`, async () => {
      const r = await api.deletePod(pod)
      setTimeout(() => { loadPods(); loadStatus() }, 1500)
      return r
    }, (r) => `Deleted pod ${r.deletedPod} — ReplicaSet is recreating it (Kubernetes self-healing)`)

  const handlePreviewFix = (name) =>
    run(`preview:${name}`, async () => {
      const r = await api.fixPreview(name)
      setPreview((prev) => ({ ...prev, [name]: r }))
      return r
    }, (r) => (r.drifted ? `${r.diffCount} proposed change(s) → review, then apply (server-validated)` : 'No drift to fix'))

  const handleApplyFix = (name) =>
    run(`fix:${name}`, async () => {
      const p = preview?.[name] || (await api.fixPreview(name))
      const r = await api.fix(name, p.proposedChanges) // server re-validates against baseline (422 if wrong)
      setFixResults((prev) => ({ ...prev, [name]: r }))
      setPreview((prev) => ({ ...prev, [name]: null }))
      setBusy('scan')
      try { setScan(await api.scan()) } catch { /* verified server-side */ }
      finally { setBusy(null) }
      await loadStatus()
      showToast(r.verified ? `${name} fix validated against baseline & verified` : `${name} fix verification FAILED`,
        r.verified ? 'ok' : 'err')
      return null
    })

  const meta = scan?.meta || status?.meta
  const llm = meta?.llm
  const cluster = meta?.cluster
  const incidentsList = scan?.incidents || status?.incidents || []
  const aiTest = aiStatus?.test
  const aiMissingKey = aiTest ? aiTest.missingKey : llm?.missingKey
  // A configured provider without its key must not be reported as connected.
  const aiConnected = aiTest ? aiTest.mode === 'connected' : (llm?.mode === 'ai' && !llm?.missingKey)
  const aiErrored = aiTest ? aiTest.mode === 'error' : false
  const clusterLive = cluster?.mode === 'live'
  const clusterUnavailable = cluster?.mode === 'unavailable'

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-5 lg:px-6">
      {/* ---------------------------------------------------------- header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 text-xl shadow-lg shadow-sky-500/20">
            🛡️
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Config Cop</h1>
            <p className="text-xs text-slate-400">AI-Assisted Configuration Drift Detector · PS08 Demo</p>
          </div>
          <div className="ml-2 flex flex-wrap gap-1.5">
            <Badge tone={clusterLive ? 'emerald' : clusterUnavailable ? 'rose' : 'amber'}>
              <span className={cx('h-1.5 w-1.5 rounded-full',
                clusterLive ? 'bg-emerald-400 pulse-dot' : clusterUnavailable ? 'bg-rose-400' : 'bg-amber-400')} />
              K8s: {clusterLive ? `LIVE · ${cluster.context}` : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED'}
            </Badge>
            <Badge tone={aiConnected ? 'violet' : aiErrored ? 'rose' : aiMissingKey ? 'amber' : 'slate'}>
              AI: {aiConnected
                ? `CONNECTED · ${(aiTest?.provider || llm?.provider)}/${(aiTest?.model || llm?.model)}`
                : aiErrored ? 'ERROR'
                : aiMissingKey ? `key missing · ${llm?.provider || 'provider'} (rule-based)` : 'not configured (rule-based)'}
            </Badge>
            <Badge tone="sky">scikit-learn IsolationForest</Badge>
            <Badge tone={selfHeal?.enabled ? 'emerald' : 'slate'}>
              <span className={cx('h-1.5 w-1.5 rounded-full', selfHeal?.enabled ? 'bg-emerald-400 pulse-dot' : 'bg-slate-500')} />
              self-heal: {selfHeal?.enabled ? 'ON' : 'off'}
            </Badge>
            <Badge tone="slate">storage: sqlite</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={cx('inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition',
              autoRefresh ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}
            title="Poll status, pods and self-heal state every 5s"
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', autoRefresh ? 'bg-emerald-400 pulse-dot' : 'bg-slate-500')} />
            {autoRefresh ? 'Live refresh ON' : 'Live refresh'}
          </button>
          <Button tone="ghost" onClick={handleTestAi} busy={busy === 'ai'}>🔌 Test AI</Button>
          <Button tone="danger" onClick={handleInject} busy={busy === 'inject'}>⚡ Inject Sample Drift</Button>
          <Button tone="primary" onClick={handleScan} busy={busy === 'scan'}>🔍 Scan for Drift</Button>
          <Button tone="ghost" onClick={handleReset} busy={busy === 'reset'}>↺ Reset Demo</Button>
        </div>
      </header>

      {/* honest cluster / AI status banners */}
      {clusterUnavailable && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <b>Kubernetes unavailable.</b> {cluster?.detail} — drift detection cannot read real workloads.
          Start Minikube (<code className="mono">minikube start</code>) and apply <code className="mono">k8s/demo-workloads.yaml</code>.
        </div>
      )}
      {cluster?.mode === 'simulated' && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <b>No live cluster detected</b> ({cluster?.error}). Running the <b>SIMULATED</b> fallback — data below is simulated, not real Kubernetes.
        </div>
      )}
      {aiErrored && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          <b>AI API error:</b> {aiTest?.error} — explanations below are <b>rule-based, not AI-generated</b>.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error} — start the backend with <code className="mono">cd backend && uvicorn app.main:app --reload --port 8000</code>
        </div>
      )}

      {toast && (
        <div className={cx('slide-in mb-4 rounded-lg border px-4 py-2.5 text-sm',
          toast.tone === 'err' ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200')}>
          {toast.msg}
        </div>
      )}

      {/* ---------------------------------------------------------- summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Workloads" value={`${workloads.length}`} tone="sky" />
        <Stat label="Drifted" value={scan ? `${drifted.length}` : '—'} tone={drifted.length ? 'rose' : 'emerald'}
              hint={scan ? (drifted.length ? drifted.join(', ') : 'all match baseline') : 'run a scan'} />
        <Stat label="Outliers (IsolationForest)" value={scan ? `${(scan.summary.outliers || []).length}` : '—'} tone="amber"
              hint={scan ? ((scan.summary.outliers || []).join(', ') || 'none') : 'after scan'} />
        <Stat label="Open Incidents" value={`${(status?.incidentsOpen || []).length}`} tone="violet"
              hint="stored in sqlite" />
        <Stat label="Last Scan" value={scan ? scan.summary.scannedAt.slice(11, 19) + 'Z' : 'never'} tone="slate"
              hint={scan ? 'UTC' : 'click Scan'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ------------------------------------------------------ left: workloads */}
        <div className="lg:col-span-2 space-y-4">
            <Panel title="Workload Health" subtitle={clusterLive
              ? `Live Kubernetes Deployments in namespace '${cluster.namespace}' · config fingerprint vs baseline`
              : 'Simulated Kubernetes deployments · config fingerprint vs baseline'}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {workloads.map((w) => {
                const d = driftByName[w.name]
                const isDrifted = d ? d.drifted : !w.matchesBaseline
                const isOutlier = outlierByName[w.name]?.isOutlier
                const ro = rollouts[w.name]
                return (
                  <button
                    key={w.name}
                    onClick={() => setSelected(w.name)}
                    className={cx(
                      'group rounded-lg border p-3 text-left transition',
                      selected === w.name ? 'border-sky-500/70 bg-sky-500/10 ring-1 ring-sky-500/40'
                        : 'border-slate-800 bg-slate-950/50 hover:border-slate-700',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-slate-100">{w.name}</div>
                        <div className="text-[11px] text-slate-500">{w.namespace} / deployment</div>
                      </div>
                      <Badge tone={isDrifted ? 'rose' : 'emerald'}>
                        <span className={cx('h-1.5 w-1.5 rounded-full', isDrifted ? 'bg-rose-400' : 'bg-emerald-400')} />
                        {isDrifted ? 'DRIFTED' : 'HEALTHY'}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {isOutlier && <Badge tone="amber">outlier</Badge>}
                      <Badge tone={ro?.status === 'Complete' ? 'emerald' : 'sky'}>
                        {ro ? `${ro.status} · ${ro.availableReplicas}/${ro.desiredReplicas}` : 'rollout n/a'}
                      </Badge>
                    </div>
                    <dl className="mt-2 space-y-1 text-[11px]">
                      <Row k="image" v={w.config.image} />
                      <Row k="replicas" v={w.config.replicas} />
                      <Row k="cpu lim" v={w.config.resources.limits.cpu} />
                      <Row k="mem lim" v={w.config.resources.limits.memory} />
                    </dl>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                      <span className="mono text-[10px] text-slate-500">fp {w.fingerprint}</span>
                      {isDrifted
                        ? <span className="text-[10px] font-medium text-rose-300">baseline {w.baselineFingerprint} → differs</span>
                        : <span className="text-[10px] font-medium text-emerald-400">matches baseline</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </Panel>

          {/* ------------------------------------------- selected detail */}
          {selectedWl && (
            <Panel
              title={`${selectedWl.name} — Drift Detail`}
              subtitle={`namespace ${selectedWl.namespace} · exact expected vs actual values`}
              right={
                <div className="flex gap-2">
                  <Button tone="ghost" onClick={() => setShowConfig((v) => !v)}>
                    {showConfig ? 'Hide' : 'Show'} full config
                  </Button>
                  <Button
                    tone="ghost"
                    busy={busy === `preview:${selectedWl.name}`}
                    disabled={!selectedDrift?.drifted}
                    onClick={() => handlePreviewFix(selectedWl.name)}
                  >
                    🪄 Preview fix
                  </Button>
                  <Button
                    tone="success"
                    busy={busy === `fix:${selectedWl.name}`}
                    disabled={!selectedDrift?.drifted}
                    onClick={() => handleFix(selectedWl.name)}
                  >
                    🩹 Fix (restore baseline)
                  </Button>
                </div>
              }
            >
              {!scan && (
                <p className="text-sm text-slate-400">
                  No scan yet — run <b className="text-slate-200">Scan for Drift</b> (or inject sample drift first) to
                  see the exact expected-vs-actual diff and an AI explanation.
                </p>
              )}

              {scan && selectedDrift && !selectedDrift.drifted && (
                <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200">
                  ✅ {selectedWl.name} matches its baseline fingerprint <span className="mono">{selectedWl.baselineFingerprint}</span> — no drift.
                </div>
              )}

              {selectedDrift?.drifted && (
                <>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge tone="rose">{selectedDrift.diffCount} field(s) drifted</Badge>
                    <Badge tone="slate">fingerprint <span className="mono">{selectedDrift.fingerprint}</span></Badge>
                    <Badge tone="slate">baseline <span className="mono">{selectedDrift.baselineFingerprint}</span></Badge>
                    {selectedOutlier && (
                      <Badge tone={selectedOutlier.isOutlier ? 'amber' : 'slate'}>
                        isolation forest score {selectedOutlier.anomalyScore}
                        {selectedOutlier.isOutlier ? ' · OUTLIER' : ''}
                      </Badge>
                    )}
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/70 text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-medium">Config field</th>
                          <th className="px-3 py-2 font-medium text-emerald-400">Expected (baseline)</th>
                          <th className="px-3 py-2 font-medium text-rose-400">Actual (live)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {selectedDrift.diffs.map((d) => (
                          <tr key={d.path} className="bg-slate-900/40">
                            <td className="mono px-3 py-2 text-slate-300">{d.path}</td>
                            <td className="mono px-3 py-2 text-emerald-300">{fmt(d.expected)}</td>
                            <td className="mono px-3 py-2 text-rose-300">
                              {fmt(d.actual)} <span className="text-rose-500">← drifted</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* AI explanation */}
                  {(() => {
                    const fromAi = !!selectedExplanation?.source?.startsWith('ai:')
                    return (
                      <div className={cx('mt-3 rounded-lg border p-3',
                        fromAi ? 'border-violet-500/30 bg-violet-500/5' : 'border-slate-700 bg-slate-950/50')}>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className={cx('text-xs font-semibold uppercase tracking-wider',
                            fromAi ? 'text-violet-300' : 'text-slate-400')}>
                            {fromAi ? '🤖 AI explanation' : '📄 Explanation (rule-based fallback)'}
                          </span>
                          <Badge tone={fromAi ? 'violet' : selectedExplanation?.aiError ? 'rose' : 'slate'}>
                            {fromAi ? selectedExplanation?.source : 'rule-based — NOT AI'}
                          </Badge>
                        </div>
                        {selectedExplanation?.aiError && (
                          <div className="mb-2 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-200">
                            AI call failed: {selectedExplanation.aiError} — showing the deterministic rule-based text below.
                          </div>
                        )}
                        {selectedExplanation?.aiPartial && (
                          <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-200">
                            The model omitted {(selectedExplanation.aiPartialFields || []).join(', ') || 'some fields'} —
                            {' '}those sections use the deterministic rule-based text, not AI.
                          </div>
                        )}
                        <p className="text-sm leading-relaxed text-slate-200">{selectedExplanation?.explanation}</p>
                        <dl className="mt-2 grid gap-1.5 text-xs sm:grid-cols-3">
                          <MiniKV k="Likely cause" v={selectedExplanation?.likelyCause} />
                          <MiniKV k="Risk" v={selectedExplanation?.risk} />
                          <MiniKV k="Recommended action" v={selectedExplanation?.recommendedAction} />
                        </dl>
                        <p className="mt-2 text-[10px] text-slate-500">
                          AI only produces text — fixes are computed &amp; validated server-side against the baseline; no commands are executed.
                        </p>
                      </div>
                    )
                  })()}

                  {/* matched past incidents */}
                  {selectedMatches.length > 0 && (
                    <div className="mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
                      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-sky-300">
                        🔁 Similar past incidents (recurring problem match)
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {selectedMatches.map((m) => (
                          <li key={m.id} className="flex flex-wrap items-center gap-2">
                            <Badge tone="sky">{Math.round(m.similarity * 100)}% match</Badge>
                            <span className="mono text-slate-400">#{m.id}</span>
                            <span>{m.title}</span>
                            <span className="text-slate-500">→ fix: {m.suggestedFix || m.fix_applied || 'n/a'}</span>
                            <Badge tone="emerald">applied &amp; verified</Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-[10px] text-slate-500">
                        Historical suggestion only — these fixes were applied and verified on this workload in the past,
                        they are not a guarantee for the current drift. Confirm against the baseline before applying.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* AI-assisted proposed fix (server-computed from baseline, re-validated on apply) */}
              {preview[selectedWl.name] && (() => {
                const p = preview[selectedWl.name]
                return (
                  <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                        🪄 Proposed fix (server-computed from baseline)
                      </span>
                      <Badge tone="violet">{p.diffCount} change(s)</Badge>
                    </div>
                    {!p.proposedChanges?.length ? (
                      <p className="text-xs text-slate-400">No changes needed — already matches baseline.</p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950/70 text-slate-400">
                            <tr>
                              <th className="px-3 py-1.5 font-medium">Config field</th>
                              <th className="px-3 py-1.5 font-medium text-emerald-400">Set to (baseline)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {p.proposedChanges.map((c) => (
                              <tr key={c.path} className="bg-slate-900/40">
                                <td className="mono px-3 py-1.5 text-slate-300">{c.path}</td>
                                <td className="mono px-3 py-1.5 text-emerald-300">{fmt(c.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        tone="success"
                        busy={busy === `fix:${selectedWl.name}`}
                        disabled={!p.proposedChanges?.length}
                        onClick={() => handleApplyFix(selectedWl.name)}
                      >
                        ✅ Apply validated fix
                      </Button>
                      <button
                        onClick={() => setPreview((prev) => ({ ...prev, [selectedWl.name]: null }))}
                        className="text-[11px] text-slate-400 underline hover:text-slate-200"
                      >
                        cancel
                      </button>
                      <span className="text-[10px] text-slate-500">
                        Re-validated against the baseline on apply (HTTP 422 if it doesn't reproduce it exactly).
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* fix verification result */}
              {fixResults[selectedWl.name] && (() => {
                const r = fixResults[selectedWl.name]
                const ok = r.verified
                return (
                  <div className={cx('mt-3 rounded-lg border p-3 text-sm slide-in',
                    ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                       : 'border-amber-500/40 bg-amber-500/10 text-amber-200')}>
                    <div className="font-semibold">
                      {ok ? '✅ Fix verified' : '⚠️ Fix NOT verified'} — {selectedWl.name}
                    </div>
                    <ul className="mt-1 list-inside list-disc text-xs">
                      <li>Reverted: {(r.revertedFields || []).join(', ') || 'none'}</li>
                      <li>Fingerprint <span className="mono">{r.fingerprint}</span> {ok ? '==' : '!='} baseline <span className="mono">{r.baselineFingerprint}</span></li>
                      <li>Re-scan: {r.rescan?.healthy ? 'healthy, drift resolved' : 'STILL DRIFTED'}</li>
                      <li>Resolved incidents: {(r.resolvedIncidents || []).map((i) => `#${i}`).join(', ') || 'none'}</li>
                      {(r.failedIncidents || []).length > 0 && (
                        <li className="text-amber-300">Incidents kept open/failed: {(r.failedIncidents || []).map((i) => `#${i}`).join(', ')}</li>
                      )}
                      <li>Method: {r.source}</li>
                    </ul>
                  </div>
                )
              })()}

              {showConfig && (
                <pre className="mono mt-3 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] text-slate-400">
                  {JSON.stringify(selectedWl.config, null, 2)}
                </pre>
              )}
            </Panel>
          )}

          {/* ------------------------------------------- incidents history */}
          <Panel title="Incident History" subtitle="past incidents & fixes stored in SQLite — matched automatically when similar drift recurs">
            {!incidentsList.length ? (
              <p className="text-sm text-slate-400">No incidents yet. Inject drift and scan to record one.</p>
            ) : (
              <ul className="space-y-2">
                {incidentsList.map((i) => (
                  <li key={i.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="mono text-slate-500">#{i.id}</span>
                      <Badge tone={i.status === 'open' ? 'rose' : i.status === 'failed' ? 'amber' : 'emerald'}>{i.status}</Badge>
                      <span className="font-medium text-slate-200">{i.title}</span>
                      {i.explain_source && <Badge tone={i.explain_source.startsWith('ai:') ? 'violet' : 'slate'}>{i.explain_source}</Badge>}
                      <span className="ml-auto text-slate-500">{i.created_at}{i.resolved_at ? ` → ${i.resolved_at}` : ''}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{i.explanation}</p>
                    {i.fix_applied && (
                      <p className={`mt-1 text-xs ${i.status === 'failed' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {i.status === 'failed' ? '⚠️' : '🔧'} {i.fix_applied}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ------------------------------------------------------ right rail */}
        <div className="space-y-4">
          <Panel title="Outlier Detection" subtitle="IsolationForest over workload feature vectors (unsupervised)">
            {!scan ? (
              <p className="text-sm text-slate-400">Run a scan to score workloads.</p>
            ) : (
              <ul className="space-y-2">
                {(scan.outliers?.results || []).map((o) => (
                  <li key={o.workload} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{o.workload}</span>
                      {o.isOutlier ? <Badge tone="amber">OUTLIER</Badge> : <Badge tone="emerald">normal</Badge>}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={cx('h-full rounded-full', o.isOutlier ? 'bg-amber-400' : 'bg-emerald-500')}
                        style={{ width: `${Math.min(100, o.anomalyScore * 400)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                      <span>score {o.anomalyScore}</span>
                      <span>Δ vs baseline {o.baselineDistance}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Self-Healing"
            subtitle={selfHeal?.enabled
              ? `${selfHeal.mode} · auto-fixes drift every ${selfHeal.interval}s`
              : 'auto-remediate config drift back to the approved baseline'}
            right={
              <Badge tone={selfHeal?.enabled ? 'emerald' : 'slate'}>
                {selfHeal?.enabled ? 'ENABLED' : 'disabled'}
              </Badge>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                tone={selfHeal?.enabled ? 'danger' : 'success'}
                busy={busy === 'selfheal'}
                onClick={handleSelfHealToggle}
              >
                {selfHeal?.enabled ? '⏸ Disable' : '▶ Enable self-heal'}
              </Button>
              <Button tone="ghost" busy={busy === 'healnow'} onClick={handleHealNow}>🩺 Heal now</Button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <MiniKV k="Passes" v={selfHeal?.passes ?? 0} />
              <MiniKV k="Healed" v={selfHeal?.healed ?? 0} />
              <MiniKV k="Last run" v={selfHeal?.lastRunAt ? selfHeal.lastRunAt.slice(11, 19) + 'Z' : '—'} />
            </div>
            <div className="mt-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Healing log</div>
              {!(selfHeal?.events || []).length ? (
                <p className="text-xs text-slate-400">No healing actions yet. Enable self-heal (or Inject + wait) to auto-restore drift.</p>
              ) : (
                <ul className="max-h-52 space-y-1.5 overflow-auto">
                  {selfHeal.events.slice(0, 10).map((e, i) => (
                    <li key={i} className="rounded-md border border-slate-800 bg-slate-950/50 px-2 py-1.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <Badge tone={e.verified ? 'emerald' : 'rose'}>{e.verified ? 'HEALED' : 'FAILED'}</Badge>
                        <span className="font-medium text-slate-200">{e.workload}</span>
                        <span className="ml-auto text-slate-500">{e.at?.slice(11, 19)}Z</span>
                      </div>
                      <div className="mt-0.5 truncate text-slate-500">
                        {e.error ? e.error : `reverted ${(e.revertedFields || []).join(', ') || '—'}`} · {e.mode}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Only ever restores the previously approved baseline — no invented config, no arbitrary commands.
            </p>
          </Panel>

          <Panel
            title="Kubernetes Pods"
            subtitle={pods[0]?.live
              ? `live pods · restarts & recreation = k8s self-healing`
              : 'simulated pods (no live cluster)'}
            right={<Badge tone={pods[0]?.live ? 'emerald' : 'amber'}>{pods[0]?.live ? 'LIVE' : 'SIMULATED'}</Badge>}
          >
            {!pods.length ? (
              <p className="text-sm text-slate-400">No pods found.</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-auto">
                {pods.map((p) => (
                  <li key={p.name} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-2.5 py-1.5 text-[11px]">
                    <Badge tone={p.phase === 'Running' && p.ready ? 'emerald' : 'amber'}>{p.phase}</Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-200">{p.name}</div>
                      <div className="text-slate-500">
                        {p.app} · restarts {p.restarts}
                      </div>
                    </div>
                    <button
                      onClick={() => handleKillPod(p.name)}
                      disabled={!p.live || busy === `pod:${p.name}`}
                      title="Delete this pod — the ReplicaSet recreates it"
                      className="rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-300 hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {busy === `pod:${p.name}` ? '…' : 'kill'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10px] text-slate-500">
              Killing a pod deletes one replica; Kubernetes' ReplicaSet immediately recreates it — no config change.
            </p>
          </Panel>

          <Panel
            title="Cluster Ops"
            subtitle={clusterLive ? `Live kubectl · context '${cluster.context}'` : 'SIMULATED replicas & rollout (no live cluster)'}
          >
            <ul className="space-y-2">
              {workloads.map((w) => {
                const ro = rollouts[w.name]
                const busyKey = `scale:${w.name}`
                return (
                  <li key={w.name} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-200">{w.name}</span>
                      <Badge tone={ro?.status === 'Complete' ? 'emerald' : 'sky'}>{ro?.status || '—'}</Badge>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {ro?.availableReplicas}/{ro?.desiredReplicas} available
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleScale(w.name, -1)}
                          disabled={busy === busyKey || (ro?.desiredReplicas ?? 1) <= 0}
                          className="h-6 w-6 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                        >−</button>
                        <span className="mono w-6 text-center text-xs text-slate-300">{ro?.desiredReplicas ?? '—'}</span>
                        <button
                          onClick={() => handleScale(w.name, +1)}
                          disabled={busy === busyKey}
                          className="h-6 w-6 rounded border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                        >+</button>
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{ro?.reason}</p>
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel title="How this demo works" subtitle="PS08 · real cluster + real AI where available; honest fallback otherwise">
            <ol className="list-inside list-decimal space-y-1 text-xs text-slate-400">
              <li>Live Deployments read via kubectl; configs fingerprinted (SHA-256 of canonical JSON) vs baseline.</li>
              <li>Exact field diff = expected vs actual; IsolationForest flags outliers.</li>
              <li>Explanations from a real OpenAI-compatible LLM; clearly-labelled rule-based fallback on failure.</li>
              <li>Incidents in SQLite; similar past incidents matched via TF-IDF cosine.</li>
              <li>Fix patches the real Deployment back to baseline, re-reads it and re-scans to verify.</li>
              <li>Self-healing watcher auto-detects drift and restores the baseline on an interval; k8s also heals pods natively (probes + ReplicaSet recreation).</li>
            </ol>
          </Panel>
        </div>
      </div>

      <footer className="mt-6 border-t border-slate-900 pt-4 text-center text-[11px] text-slate-600">
        Config Cop · hackathon demo (PS08) · K8s: {clusterLive ? `LIVE (${cluster?.context})` : 'SIMULATED'} ·
        AI: {aiConnected ? 'CONNECTED' : 'not configured'} · API keys stay server-side
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ bits */

function Stat({ label, value, hint, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-100', sky: 'text-sky-300', rose: 'text-rose-300',
    amber: 'text-amber-300', emerald: 'text-emerald-300', violet: 'text-violet-300',
  }
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cx('text-xl font-bold', tones[tone])}>{value}</div>
      {hint && <div className="truncate text-[10px] text-slate-500">{hint}</div>}
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="mono truncate text-slate-300">{fmt(v)}</dd>
    </div>
  )
}

function MiniKV({ k, v }) {
  return (
    <div className="rounded-md bg-slate-950/50 p-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{k}</div>
      <div className="text-slate-300">{v || '—'}</div>
    </div>
  )
}
