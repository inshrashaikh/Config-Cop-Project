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
  status:          ()                   => req('/api/status'),
  scan:            ()                   => req('/api/scan',             { method: 'POST' }),
  inject:          (body = {})          => req('/api/drift/introduce',   { method: 'POST', body: JSON.stringify(body) }),
  fix:             (workload)           => req('/api/fix',              { method: 'POST', body: JSON.stringify({ workload }) }),
  scale:           (workload, replicas) => req('/api/scale',            { method: 'POST', body: JSON.stringify({ workload, replicas }) }),
  rollout:         (workload)           => req(`/api/rollout/${workload}`),
  reset:           ()                   => req('/api/reset',            { method: 'POST' }),
  clusterStatus:   (force = false)      => req(`/api/cluster/status${force ? '?force=true' : ''}`),
  llmStatus:       (check = true)       => req(`/api/llm/status?check=${check}`),
  llmTest:         ()                   => req('/api/llm/test',         { method: 'POST' }),
  captureBaseline: ()                   => req('/api/baseline/capture', { method: 'POST' }),
  baseline:        ()                   => req('/api/baseline'),
  incidents:       (limit = 50)         => req(`/api/incidents?limit=${limit}`),
  health:          ()                   => req('/api/health'),
}
