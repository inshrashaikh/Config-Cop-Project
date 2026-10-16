import { useState, useEffect } from 'react'
import {
  Settings, Server, Cpu, Activity, Shield, CheckCircle,
  AlertTriangle, RefreshCw, Key, Terminal, Lock
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { Panel, Badge, Button, Alert } from '../components/ui/index.jsx'
import { api } from '../api.js'

export default function SettingsPage() {
  const {
    cluster,
    clusterLive,
    clusterUnavailable,
    aiConnected,
    aiErrored,
    aiMissingKey,
    llm,
    aiStatus,
    handleTestAi,
    busy,
    loadAiStatus,
  } = useApp()

  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const checkHealth = async () => {
    setLoadingHealth(true)
    try {
      const h = await api.health()
      setHealth(h)
    } catch (e) {
      setHealth({ status: 'error', message: e.message })
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const runTest = async () => {
    const res = await handleTestAi()
    if (res) setTestResult(res)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--forest)', letterSpacing: '-0.02em' }}>
            System Settings &amp; Connectivity
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Audit backend services, Kubernetes cluster endpoints, AI provider connectivity, and security configuration.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Button
            variant="secondary"
            onClick={() => {
              checkHealth()
              loadAiStatus(true)
            }}
            busy={loadingHealth}
          >
            <RefreshCw size={13} />
            Recheck All
          </Button>
        </div>
      </div>

      {/* ── Grid of Status Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Kubernetes Cluster Card */}
        <Panel
          title="Kubernetes Cluster Integration"
          subtitle="Cluster discovery and namespace context"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Cluster Mode</span>
              <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
                {clusterLive ? 'LIVE KUBERNETES' : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED MODE'}
              </Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Kube Context</span>
              <code style={{ fontSize: 12 }}>{cluster?.context || 'none'}</code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Target Namespace</span>
              <code style={{ fontSize: 12 }}>{cluster?.namespace || 'default'}</code>
            </div>

            {cluster?.error && (
              <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', fontSize: 12, color: 'var(--warning)' }}>
                <strong>Cluster Notice:</strong> {cluster.error}
              </div>
            )}

            {cluster?.detail && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {cluster.detail}
              </p>
            )}
          </div>
        </Panel>

        {/* AI Model Provider Card */}
        <Panel
          title="AI Reasoning Provider"
          subtitle="Analytical explanation engine status"
          right={
            <Button
              variant="primary"
              size="sm"
              onClick={runTest}
              busy={busy === 'ai'}
            >
              <Activity size={13} />
              Test Connection
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Provider Mode</span>
              <Badge variant={aiConnected ? 'info' : aiErrored ? 'danger' : 'neutral'}>
                {aiConnected ? 'AI CONNECTED' : aiMissingKey ? 'API KEY MISSING' : 'OFFLINE RULE-BASED'}
              </Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Configured Provider</span>
              <code style={{ fontSize: 12 }}>{llm?.provider || 'none'}</code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Configured Model</span>
              <code style={{ fontSize: 12 }}>{llm?.model || 'none'}</code>
            </div>

            {testResult && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: testResult.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${testResult.ok ? 'var(--success-border)' : 'var(--danger-border)'}`,
                fontSize: 12,
              }}>
                {testResult.ok ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                    ✅ AI Connected successfully: {testResult.provider}/{testResult.model} ({testResult.latencyMs}ms)
                  </span>
                ) : (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                    ❌ AI Connection failed: {testResult.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Environment Configuration & Setup Guides ── */}
      <Panel title="Environment Setup &amp; Deployment Guides" subtitle="Instructions for running with live Kubernetes and configuring server-side AI keys">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          <div className="surface-cream" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Terminal size={16} color="var(--forest)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Enabling Live Kubernetes Mode</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              To connect Config Cop to a real local cluster, start Minikube or ensure your <code>~/.kube/config</code> has an active context:
            </p>
            <pre style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: '#FFFFFF',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              overflowX: 'auto',
              marginBottom: 10,
            }}>
              minikube start{'\n'}kubectl apply -f k8s/demo-workloads.yaml
            </pre>
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              Config Cop automatically detects the live context on the next status refresh.
            </p>
          </div>

          <div className="surface-cream" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Key size={16} color="var(--forest)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)' }}>Configuring AI API Keys</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>
              To enable AI root-cause analysis, configure your provider in the backend <code>.env</code> file:
            </p>
            <pre style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              background: '#FFFFFF',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--border-light)',
              overflowX: 'auto',
              marginBottom: 10,
            }}>
              OPENAI_API_KEY=sk-...{'\n'}CONFIG_COP_LLM_PROVIDER=openai{'\n'}CONFIG_COP_LLM_MODEL=gpt-4o-mini
            </pre>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--forest-mid)' }}>
              <Lock size={12} />
              <span>API keys remain securely server-side; they are never sent to the browser.</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
