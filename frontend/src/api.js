const BASE = import.meta.env.VITE_API_URL || ''

async function req(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body)
    } catch { /* keep statusText */ }
    throw new Error(detail)
  }
  return res.json()
}

export const api = {
  status: () => req('/api/status'),
  scan: () => req('/api/scan', { method: 'POST' }),
  inject: (body = {}) => req('/api/drift/introduce', { method: 'POST', body: JSON.stringify(body) }),
  fix: (workload, proposedChanges) =>
    req('/api/fix', { method: 'POST', body: JSON.stringify({ workload, proposedChanges }) }),
  fixPreview: (workload) =>
    req('/api/fix/preview', { method: 'POST', body: JSON.stringify({ workload }) }),
  scale: (workload, replicas) =>
    req('/api/scale', { method: 'POST', body: JSON.stringify({ workload, replicas }) }),
  rollout: (workload) => req(`/api/rollout/${workload}`),
  reset: () => req('/api/reset', { method: 'POST' }),
  clusterStatus: (force = false) => req(`/api/cluster/status${force ? '?force=true' : ''}`),
  llmStatus: (check = true) => req(`/api/llm/status?check=${check}`),
  llmTest: () => req('/api/llm/test', { method: 'POST' }),
  captureBaseline: () => req('/api/baseline/capture', { method: 'POST' }),
  selfHeal: () => req('/api/selfheal'),
  setSelfHeal: (enabled, interval) =>
    req('/api/selfheal', { method: 'POST', body: JSON.stringify({ enabled, interval }) }),
  selfHealRun: () => req('/api/selfheal/run', { method: 'POST' }),
  pods: () => req('/api/pods'),
  deletePod: (name) => req(`/api/pods/${encodeURIComponent(name)}/delete`, { method: 'POST' }),
  activity: (limit = 50) => req(`/api/activity?limit=${limit}`),
  logs: (workload, tail = 100) => req(`/api/logs/${encodeURIComponent(workload)}?tail=${tail}`),
  autoscale: () => req('/api/autoscale'),
  autoscaleApply: (workload, replicas) =>
    req('/api/autoscale/apply', { method: 'POST', body: JSON.stringify({ workload, replicas }) }),
}
