import { useState } from 'react'
import { SiDocker, SiKubernetes } from 'react-icons/si'
import { Shield, Check, AlertTriangle, Cpu, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react'
import { Badge } from '../ui/index.jsx'
import './InfrastructureDiagram.css'

export default function InfrastructureDiagram() {
  const [fixed, setFixed] = useState(false)

  return (
    <div className="infra-diagram-root" aria-label="Configuration Drift Detection Architecture Visualization">
      {/* Visual Window Header */}
      <div className="infra-diagram-header">
        <div className="infra-diagram-title">
          <Shield size={16} color="var(--forest)" />
          <span>Config Cop Engine · Drift Audit Pipeline</span>
          <span className="infra-diagram-title-badge">k8s/v1.31</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Badge variant="neutral">Illustrative Demo</Badge>
          <div className="infra-diagram-dots" aria-hidden="true">
            <span className="infra-diagram-dot" />
            <span className="infra-diagram-dot" />
            <span className="infra-diagram-dot" style={{ background: 'var(--sage-deep)' }} />
          </div>
        </div>
      </div>

      <div className="infra-pipeline">
        {/* Tier 1: Target Workload in Kubernetes */}
        <div className="infra-card">
          <div className="infra-card-header">
            <div className="infra-card-label">
              <SiKubernetes color="#326CE5" size={17} />
              <span>Deployment: <strong>checkout-api</strong></span>
            </div>
            <div className="infra-card-tag">ns: default</div>
          </div>

          {/* 2-Col Split: Baseline Source vs Live Cluster State */}
          <div className="infra-split-grid">
            {/* Baseline Column */}
            <div className="infra-subcard baseline">
              <div className="infra-subcard-title">
                <span style={{ color: 'var(--success-solid)' }}>Expected (GitOps Baseline)</span>
                <span className="badge badge-success" style={{ fontSize: 10, padding: '1px 6px' }}>sha256:7a4c</span>
              </div>
              <div className="infra-diff-list">
                <div className="infra-diff-row">
                  <span className="infra-diff-key">replicas</span>
                  <span className="infra-diff-val-ok">3</span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">cpu.limit</span>
                  <span className="infra-diff-val-ok">500m</span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">image.tag</span>
                  <span className="infra-diff-val-ok">v1.4.0</span>
                </div>
              </div>
            </div>

            {/* Live State Column */}
            <div className={`infra-subcard ${fixed ? 'baseline' : 'live-drifted'}`}>
              <div className="infra-subcard-title">
                <span style={{ color: fixed ? 'var(--success-solid)' : 'var(--danger-solid)' }}>
                  {fixed ? 'Live Cluster (Restored)' : 'Live Cluster (Drifted)'}
                </span>
                <span
                  className={`badge ${fixed ? 'badge-success' : 'badge-danger'}`}
                  style={{ fontSize: 10, padding: '1px 6px' }}
                >
                  {fixed ? 'sha256:7a4c' : 'sha256:e92b'}
                </span>
              </div>
              <div className="infra-diff-list">
                <div className={`infra-diff-row ${!fixed ? 'drift-highlight' : ''}`}>
                  <span className="infra-diff-key">replicas</span>
                  <span className={fixed ? 'infra-diff-val-ok' : 'infra-diff-val-err'}>
                    {fixed ? '3' : '1 (differs)'}
                  </span>
                </div>
                <div className={`infra-diff-row ${!fixed ? 'drift-highlight' : ''}`}>
                  <span className="infra-diff-key">cpu.limit</span>
                  <span className={fixed ? 'infra-diff-val-ok' : 'infra-diff-val-err'}>
                    {fixed ? '500m' : '2000m (differs)'}
                  </span>
                </div>
                <div className="infra-diff-row">
                  <span className="infra-diff-key">image.tag</span>
                  <span className="infra-diff-val-ok">v1.4.0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Connector: Detection & Anomaly Analysis */}
        <div className="infra-flow-connector" aria-hidden="true">
          <div className="infra-flow-line" />
          <div className="infra-flow-pulse">
            <Cpu size={12} />
            <span>IsolationForest · Anomaly Score: {fixed ? '0.04' : '0.87'}</span>
          </div>
          <div className="infra-flow-line" />
        </div>

        {/* Tier 2: AI Root Cause Analysis & Remediation */}
        <div className="infra-analysis-box">
          <div className="infra-analysis-header">
            <span className="infra-ai-badge">
              <Sparkles size={12} />
              <span>AI Root-Cause Diagnosis</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              Deterministic GitOps verification
            </span>
          </div>

          <div className="infra-ai-text">
            {fixed ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--success-text)', fontWeight: 600 }}>
                <CheckCircle2 size={16} color="var(--success-solid)" />
                <span>Workload restored to canonical baseline specifications. Zero drift remaining.</span>
              </div>
            ) : (
              <div>
                <strong>Diagnosis:</strong> Manual <code>kubectl scale</code> and CPU limit override detected outside of GitOps CI/CD.
                Operational risk: high latency and single-point-of-failure on 1 replica.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-micro)', color: 'var(--text-secondary)' }}>
              <SiDocker size={14} color="#2496ED" />
              <span>Container: checkout-api:v1.4.0</span>
            </div>
            <button
              onClick={() => setFixed(f => !f)}
              className={`btn btn-sm ${fixed ? 'btn-secondary' : 'btn-primary'}`}
              style={{ fontSize: 12, padding: '4px 10px', minHeight: 28 }}
            >
              {fixed ? <RefreshCw size={12} /> : <Check size={12} />}
              {fixed ? 'Simulate Drift Again' : 'One-Click Baseline Restore'}
            </button>
          </div>
        </div>
      </div>

      {/* Footer info strip */}
      <div className="infra-diagram-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: fixed ? 'var(--success-solid)' : 'var(--danger-solid)'
          }} />
          <span>Status: {fixed ? 'Healthy · In Baseline' : 'Drift Detected · 2 Discrepancies'}</span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          Deterministic Remediation
        </span>
      </div>
    </div>
  )
}
