import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../api.js'
import { useToast } from '../hooks/useToast.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [status, setStatus] = useState(null)
  const [scan, setScan] = useState(null)
  const [selectedWorkload, setSelectedWorkload] = useState(null)
  const [busy, setBusy] = useState(null)
  const [fixResults, setFixResults] = useState({})
  const [error, setError] = useState(null)
  const [aiStatus, setAiStatus] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [loadingIncidents, setLoadingIncidents] = useState(false)

  // CallChip operations tracking
  const [operations, setOperations] = useState({
    scan:     { status: 'idle', label: 'Drift Scan', duration: 3500 },
    inject:   { status: 'idle', label: 'Drift Injection', duration: 2500 },
    reset:    { status: 'idle', label: 'Cluster Reset', duration: 3000 },
    baseline: { status: 'idle', label: 'Baseline Capture', duration: 2500 },
    ai:       { status: 'idle', label: 'AI Connectivity Test', duration: 2000 },
  })

  // ThoughtLine progress tracking for async multi-step operations (like scan)
  const [thoughtState, setThoughtState] = useState({
    active: false,
    steps: [],
    isComplete: false,
    isError: false,
    title: null,
    startTime: null,
  })

  const { toasts, addToast } = useToast()

  const setOpStatus = useCallback((key, opStatus) => {
    setOperations(prev => ({
      ...prev,
      [key]: { ...prev[key], status: opStatus },
    }))
  }, [])

  // Load status
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

  // Load AI status
  const loadAiStatus = useCallback(async (check = true) => {
    try {
      const s = await api.llmStatus(check)
      setAiStatus(s)
    } catch (e) {
      setAiStatus({ error: e.message })
    }
  }, [])

  // Load incidents history
  const loadIncidents = useCallback(async (limit = 50) => {
    setLoadingIncidents(true)
    try {
      const res = await api.incidents(limit)
      setIncidents(Array.isArray(res) ? res : res.incidents || [])
    } catch (e) {
      console.warn('Could not load incidents:', e.message)
    } finally {
      setLoadingIncidents(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
    loadAiStatus(true)
    loadIncidents()
  }, [loadStatus, loadAiStatus, loadIncidents])

  // Computed data
  const workloads = useMemo(() => status?.workloads || [], [status])
  const rollouts = useMemo(
    () => Object.fromEntries((status?.rollouts || []).map(r => [r.workload, r])),
    [status],
  )
  const driftByName = useMemo(
    () => Object.fromEntries((scan?.drift || []).map(d => [d.workload, d])),
    [scan],
  )
  const outlierByName = useMemo(
    () => Object.fromEntries((scan?.outliers?.results || []).map(o => [o.workload, o])),
    [scan],
  )
  const drifted = useMemo(() => scan?.summary?.drifted || [], [scan])

  // Default selection
  useEffect(() => {
    if (!workloads.length) return
    if (selectedWorkload && workloads.some(w => w.name === selectedWorkload)) return
    const firstDrifted = (scan?.summary?.drifted || [])[0]
    setSelectedWorkload(firstDrifted || workloads[0].name)
  }, [workloads, scan, selectedWorkload])

  // Cluster & AI meta
  const meta = scan?.meta || status?.meta
  const llm = meta?.llm
  const cluster = meta?.cluster
  const clusterLive = cluster?.mode === 'live'
  const clusterUnavailable = cluster?.mode === 'unavailable'
  const clusterMode = cluster?.mode || 'simulated'

  const aiTest = aiStatus?.test
  const aiMissingKey = aiTest ? aiTest.missingKey : llm?.missingKey
  const aiConnected = aiTest ? aiTest.mode === 'connected' : (llm?.mode === 'ai' && !llm?.missingKey)
  const aiErrored = aiTest ? aiTest.mode === 'error' : false

  // Generic runner
  const run = useCallback(async (actionKey, opKey, fn, okMsg) => {
    setBusy(actionKey)
    if (opKey) setOpStatus(opKey, 'running')
    try {
      const res = await fn()
      if (opKey) setOpStatus(opKey, 'done')
      if (okMsg) {
        const msg = typeof okMsg === 'function' ? await okMsg(res) : okMsg
        if (msg) addToast(msg, 'success')
      }
      return res
    } catch (e) {
      if (opKey) setOpStatus(opKey, 'error')
      addToast(e.message, 'error', 'Operation Failed')
      return null
    } finally {
      setBusy(null)
    }
  }, [addToast, setOpStatus])

  // Scan with ThoughtLine progress steps
  const handleScan = useCallback(async () => {
    setThoughtState({
      active: true,
      title: 'Auditing cluster workload configurations…',
      startTime: new Date(),
      isComplete: false,
      isError: false,
      steps: [
        { id: 1, text: 'Querying Kubernetes deployment manifests', status: 'active' },
        { id: 2, text: 'Computing SHA-256 canonical fingerprints', status: 'pending' },
        { id: 3, text: 'Evaluating expected vs actual configuration diffs', status: 'pending' },
        { id: 4, text: 'Executing IsolationForest outlier anomaly model', status: 'pending' },
        { id: 5, text: 'Synthesizing root-cause analysis', status: 'pending' },
      ],
    })

    // Advance step 1 -> 2
    const timer1 = setTimeout(() => {
      setThoughtState(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === 1 ? { ...s, status: 'completed' } : s.id === 2 ? { ...s, status: 'active' } : s),
      }))
    }, 400)

    const timer2 = setTimeout(() => {
      setThoughtState(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === 2 ? { ...s, status: 'completed' } : s.id === 3 ? { ...s, status: 'active' } : s),
      }))
    }, 900)

    const timer3 = setTimeout(() => {
      setThoughtState(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.id === 3 ? { ...s, status: 'completed' } : s.id === 4 ? { ...s, status: 'active' } : s),
      }))
    }, 1500)

    try {
      const res = await run('scan', 'scan', api.scan, (r) => {
        return r.summary.drifted.length
          ? `Scan complete — drift detected in ${r.summary.drifted.length} workload(s): ${r.summary.drifted.join(', ')}`
          : 'Scan complete — all workloads match baseline specifications'
      })

      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)

      if (res) {
        setScan(res)
        await loadStatus()
        await loadIncidents()
        setThoughtState(prev => ({
          ...prev,
          isComplete: true,
          title: `Scan finished: ${res.summary.drifted.length} drifted workload(s)`,
          steps: prev.steps.map(s => ({ ...s, status: 'completed' })),
        }))
      } else {
        setThoughtState(prev => ({
          ...prev,
          isError: true,
          title: 'Drift scan failed',
        }))
      }
      return res
    } catch (e) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      setThoughtState(prev => ({
        ...prev,
        isError: true,
        title: `Scan error: ${e.message}`,
      }))
      return null
    }
  }, [run, loadStatus, loadIncidents])

  // Inject sample drift
  const handleInject = useCallback(async (payload = {}) => {
    return run('inject', 'inject', () => api.inject(payload), async (r) => {
      const s = await loadStatus()
      if (s) setScan(null) // stale scan cleared
      await loadIncidents()
      const names = (r.injected || []).map(i => i.workload).join(', ')
      const where = r.clusterMode === 'live' ? 'REAL cluster (kubectl patch)' : 'SIMULATED'
      if (r.errors?.length) return `Injected into ${names} on ${where}; ${r.errors.length} failed: ${r.errors[0].error}`
      return `Sample drift injected into ${names || 'workloads'} (${where})`
    })
  }, [run, loadStatus, loadIncidents])

  // Fix workload (restore baseline)
  const handleFix = useCallback(async (workloadName) => {
    const actionKey = `fix:${workloadName}`
    return run(actionKey, null, () => api.fix(workloadName), async (r) => {
      setFixResults(prev => ({ ...prev, [workloadName]: r }))
      // Re-scan automatically to verify resolution across the entire dashboard
      try {
        setBusy('scan')
        const s = await api.scan()
        setScan(s)
      } catch {
        /* Fix verified server-side */
      } finally {
        setBusy(null)
      }
      await loadStatus()
      await loadIncidents()
      return r.verified
        ? `${workloadName} restored — SHA-256 fingerprint verified against baseline`
        : `${workloadName} fix verification FAILED`
    })
  }, [run, loadStatus, loadIncidents])

  // Scale workload
  const handleScale = useCallback(async (workloadName, delta) => {
    const current = rollouts[workloadName]?.desiredReplicas ?? 1
    const target = Math.max(0, current + delta)
    const actionKey = `scale:${workloadName}`
    return run(actionKey, null, () => api.scale(workloadName, target), (r) => {
      loadStatus()
      return `${r.workload} scaled to ${r.replicas} replica(s) (${r.clusterMode === 'live' ? 'live kubectl' : 'simulated rollout'})`
    })
  }, [rollouts, run, loadStatus])

  // Reset demo
  const handleReset = useCallback(async () => {
    return run('reset', 'reset', async () => {
      const r = await api.reset()
      setScan(null)
      setFixResults({})
      await loadStatus()
      await loadIncidents()
      return r
    }, (r) => {
      return r.clusterMode === 'live'
        ? 'Cluster restored: demo-workloads.yaml re-applied to live Kubernetes namespace'
        : 'Demo state reset: pristine baseline restored (simulated)'
    })
  }, [run, loadStatus, loadIncidents])

  // Test AI
  const handleTestAi = useCallback(async () => {
    return run('ai', 'ai', async () => {
      const r = await api.llmTest()
      await loadAiStatus(false)
      return r
    }, (r) => {
      return r.ok
        ? `AI connected: ${r.provider}/${r.model} (${r.latencyMs}ms latency)`
        : `AI not connected: ${r.error}`
    })
  }, [run, loadAiStatus])

  // Capture baseline
  const handleCaptureBaseline = useCallback(async () => {
    return run('baseline', 'baseline', async () => {
      const r = await api.captureBaseline()
      await loadStatus()
      return r
    }, (r) => `Baseline captured for: ${(r.captured || []).join(', ')}`)
  }, [run, loadStatus])

  const value = {
    status,
    scan,
    workloads,
    rollouts,
    driftByName,
    outlierByName,
    drifted,
    selectedWorkload,
    setSelectedWorkload,
    busy,
    operations,
    thoughtState,
    setThoughtState,
    toasts,
    addToast,
    loadStatus,
    loadAiStatus,
    aiStatus,
    incidents,
    loadingIncidents,
    loadIncidents,
    fixResults,
    error,
    meta,
    llm,
    cluster,
    clusterLive,
    clusterUnavailable,
    clusterMode,
    aiConnected,
    aiErrored,
    aiMissingKey,
    handleScan,
    handleInject,
    handleFix,
    handleScale,
    handleReset,
    handleTestAi,
    handleCaptureBaseline,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
