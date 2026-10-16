import { useState, useEffect } from 'react'
import {
  Settings, Server, Cpu, Activity, Shield, CheckCircle2,
  AlertTriangle, RefreshCw, Key, Terminal, Lock,
  Clock, XCircle, Check, Database, Zap, Code
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import {
  PageHeader, Panel, Badge, Button, Alert,
  SegmentedControl, CodeBlock, CopyButton
} from '../components/ui/index.jsx'
import { api } from '../api.js'

const ENV_EXAMPLES = {
  groq: `# Groq Cloud (Ultra-Fast Inference)
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
LLM_API_KEY=gsk_your_groq_api_key_here`,

  gemini: `# Google Gemini
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_API_KEY=AIzaSy_your_gemini_api_key_here`,

  openai: `# OpenAI API
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-proj-your_openai_api_key_here`,

  ollama: `# Local Ollama (Zero External Network Calls)
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2
LLM_BASE_URL=http://localhost:11434`,
}

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
    loadStatus,
  } = useApp()

  const [health, setHealth] = useState(null)
  const [loadingHealth, setLoadingHealth] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [selectedExample, setSelectedExample] = useState('groq')

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

  const handleRecheckAll = async () => {
    await Promise.all([
      checkHealth(),
      loadAiStatus(true),
      loadStatus(),
    ])
  }

  const exampleTabs = [
    { id: 'groq',   label: 'Groq (Recommended)' },
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'ollama', label: 'Ollama (Local)' },
  ]

  const latency = testResult?.latencyMs ?? aiStatus?.test?.latencyMs

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page Header ── */}
      <PageHeader
        title="System Settings &amp; Connectivity"
        subtitle="Audit backend services, Kubernetes cluster discovery endpoints, AI provider credentials, and security boundaries."
        actions={
          <Button
            variant="secondary"
            onClick={handleRecheckAll}
            busy={loadingHealth || busy === 'ai'}
            icon={RefreshCw}
          >
            Recheck All
          </Button>
        }
      />

      {/* ── System Health Checklist (Backend, Cluster, AI) ── */}
      <Panel
        title="System Infrastructure Health Checklist"
        subtitle="Live verification of all three core architectural subsystems"
        icon={Shield}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Subsystem 1: Backend API */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="var(--forest)" />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>FastAPI Engine</span>
              </div>
              <Badge variant={health?.status === 'ok' ? 'success' : 'danger'} dot>
                {health?.status === 'ok' ? 'HEALTHY' : 'UNREACHABLE'}
              </Badge>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
              {health?.status === 'ok'
                ? `Core engine running on port 8000. Version: ${health.version || '1.0.0'}`
                : `Engine unreachable: ${health?.message || 'Check terminal'}`}
            </div>
          </div>

          {/* Subsystem 2: Kubernetes Cluster */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={16} color="var(--forest)" />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>Kubernetes Cluster</span>
              </div>
              <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
                {clusterLive ? 'LIVE' : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED'}
              </Badge>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
              {clusterLive
                ? `Active context: '${cluster?.context}', namespace: '${cluster?.namespace}'`
                : clusterUnavailable
                ? 'No cluster endpoint responding. Start Minikube or kind.'
                : `Sandbox simulation mode active (${cluster?.error || 'mock engine'}).`}
            </div>
          </div>

          {/* Subsystem 3: AI Provider */}
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={16} color="var(--forest)" />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>Reasoning Engine</span>
              </div>
              <Badge variant={aiConnected ? 'info' : aiErrored ? 'danger' : 'neutral'}>
                {aiConnected ? 'AI CONNECTED' : aiMissingKey ? 'KEY MISSING' : 'RULE-BASED'}
              </Badge>
            </div>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Provider: <code>{llm?.provider || 'none'}</code></span>
              {typeof latency === 'number' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--forest)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} />
                  <span>{latency}ms</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Status Detail Cards Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
        {/* Kubernetes Cluster Card */}
        <Panel
          title="Kubernetes Integration Details"
          subtitle="Cluster discovery and namespace context configuration"
          icon={Server}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Operating Mode</span>
              <Badge variant={clusterLive ? 'success' : clusterUnavailable ? 'danger' : 'warning'} dot>
                {clusterLive ? 'LIVE KUBERNETES' : clusterUnavailable ? 'UNAVAILABLE' : 'SIMULATED MODE'}
              </Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Kube Context</span>
              <code>{cluster?.context || 'none'}</code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Namespace</span>
              <code>{cluster?.namespace || 'default'}</code>
            </div>

            {cluster?.error && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--warning-bg)',
                border: '1px solid var(--warning-border)',
                fontSize: 'var(--text-caption)',
                color: 'var(--warning-text)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <AlertTriangle size={15} color="var(--warning-solid)" />
                <span><strong>Cluster Notice:</strong> {cluster.error}</span>
              </div>
            )}

            {cluster?.detail && (
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)' }}>
                {cluster.detail}
              </p>
            )}
          </div>
        </Panel>

        {/* AI Model Provider Card */}
        <Panel
          title="AI Reasoning Provider"
          subtitle="Analytical explanation engine status and roundtrip latency"
          icon={Database}
          right={
            <Button
              variant="primary"
              size="sm"
              onClick={runTest}
              busy={busy === 'ai'}
              icon={Activity}
            >
              Test Connection
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Provider Mode</span>
              <Badge variant={aiConnected ? 'info' : aiErrored ? 'danger' : 'neutral'}>
                {aiConnected ? 'AI CONNECTED' : aiMissingKey ? 'API KEY MISSING' : 'OFFLINE RULE-BASED'}
              </Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Configured Provider</span>
              <code>{llm?.provider || 'none'}</code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-caption)', fontWeight: 600, color: 'var(--text-secondary)' }}>Configured Model</span>
              <code>{llm?.model || 'none'}</code>
            </div>

            {/* Test connection result banner (Issue 11 Fix: Lucide icons instead of raw emojis) */}
            {testResult && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: testResult.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                border: `1px solid ${testResult.ok ? 'var(--success-border)' : 'var(--danger-border)'}`,
                fontSize: 'var(--text-caption)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {testResult.ok ? (
                  <>
                    <CheckCircle2 size={16} color="var(--success-solid)" />
                    <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>
                      AI Connected: {testResult.provider}/{testResult.model} ({testResult.latencyMs}ms roundtrip)
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} color="var(--danger-solid)" />
                    <span style={{ color: 'var(--danger-text)', fontWeight: 600 }}>
                      AI Connection Failed: {testResult.error}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Environment Configuration & Setup Guides (Issue 3 Fix) ── */}
      <Panel
        title="Environment Configuration &amp; Deployment Guides"
        subtitle="Real configuration variable schema matching backend engine (LLM_PROVIDER, LLM_MODEL, LLM_API_KEY, LLM_BASE_URL)"
        icon={Key}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
          {/* Guide 1: Local Kubernetes Setup */}
          <div className="surface-cream" style={{ padding: 20, borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Terminal size={17} color="var(--forest)" />
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                Connecting to Live Kubernetes
              </h3>
            </div>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12 }}>
              To audit a live cluster, ensure your local Minikube or cloud kubeconfig context is active, then apply the demo deployments:
            </p>
            <CodeBlock
              code={`minikube start\nkubectl apply -f k8s/demo-workloads.yaml`}
              language="bash"
            />
            <p style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', marginTop: 10 }}>
              Config Cop automatically discovers live contexts on next refresh.
            </p>
          </div>

          {/* Guide 2: Real LLM Environment Variables (Issue 3 Fix with SegmentedControl Tabs) */}
          <div className="surface-cream" style={{ padding: 20, borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Key size={17} color="var(--forest)" />
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)' }}>
                Configuring AI Provider (.env)
              </h3>
            </div>
            <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 12 }}>
              Set these variables in <code>backend/.env</code> or export them in your shell environment:
            </p>

            {/* SegmentedControl tabs for Groq, Gemini, OpenAI, Ollama */}
            <div style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={exampleTabs}
                value={selectedExample}
                onChange={setSelectedExample}
                name="env-provider-tabs"
              />
            </div>

            <CodeBlock
              code={ENV_EXAMPLES[selectedExample]}
              language="bash"
            />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--text-micro)',
              color: 'var(--forest-mid)',
              marginTop: 12,
              fontWeight: 500,
            }}>
              <Lock size={13} />
              <span>Supported providers: groq, gemini, openai, openrouter, together, ollama, custom, none. Keys remain strictly server-side.</span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}
