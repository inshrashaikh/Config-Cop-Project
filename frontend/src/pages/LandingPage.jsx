import { Link } from 'react-router-dom'
import {
  Shield, ArrowRight, CheckCircle2, GitBranch, Cpu,
  Sparkles, Terminal, Layers, Lock, Activity, Eye, Zap
} from 'lucide-react'
import {
  SiDocker, SiKubernetes, SiReact, SiLinux, SiGithub,
  SiPrometheus, SiPython, SiFastapi, SiSqlite
} from 'react-icons/si'

import LightRays from '../components/reactbits/LightRays.jsx'
import StarBorder from '../components/reactbits/StarBorder.jsx'
import LogoLoop from '../components/reactbits/LogoLoop.jsx'
import InfrastructureDiagram from '../components/landing/InfrastructureDiagram.jsx'
import './LandingPage.css'

export default function LandingPage() {
  const TECH_LOGOS = [
    { id: 'k8s', node: <div className="tech-icon-item"><SiKubernetes color="#326CE5" size={18} /><span>Kubernetes</span></div> },
    { id: 'docker', node: <div className="tech-icon-item"><SiDocker color="#2496ED" size={18} /><span>Docker</span></div> },
    { id: 'linux', node: <div className="tech-icon-item"><SiLinux color="#243129" size={18} /><span>Linux</span></div> },
    { id: 'fastapi', node: <div className="tech-icon-item"><SiFastapi color="#059669" size={18} /><span>FastAPI</span></div> },
    { id: 'python', node: <div className="tech-icon-item"><SiPython color="#3776AB" size={18} /><span>Python</span></div> },
    { id: 'react', node: <div className="tech-icon-item"><SiReact color="#087EA4" size={18} /><span>React</span></div> },
    { id: 'prometheus', node: <div className="tech-icon-item"><SiPrometheus color="#E6522C" size={18} /><span>Prometheus</span></div> },
    { id: 'github', node: <div className="tech-icon-item"><SiGithub color="#243129" size={18} /><span>GitOps</span></div> },
    { id: 'sqlite', node: <div className="tech-icon-item"><SiSqlite color="#003B57" size={18} /><span>SQLite</span></div> },
  ]

  return (
    <div className="landing-page">
      {/* ── Fixed Navigation Bar ── */}
      <div className="landing-nav-wrapper">
        <header className="landing-nav" role="banner">
          <Link to="/" className="landing-brand">
            <div className="landing-brand-icon" aria-hidden="true">
              <Shield size={18} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <div>
              <div className="landing-brand-text">Config Cop</div>
            </div>
          </Link>

          <nav className="landing-nav-links" aria-label="Main Navigation">
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#technology" className="landing-nav-link">Technology Stack</a>
            <a href="#architecture" className="landing-nav-link">Architecture</a>
            <a href="#security" className="landing-nav-link">Security Boundary</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/dashboard" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Launch Dashboard
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>
      </div>

      {/* ── Hero Section with LightRays ── */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        {/* React Bits LightRays effect placed subtly behind content */}
        <LightRays
          raysOrigin="top-center"
          raysColor="#8FB594"
          lightSpread={2.2}
          raysSpeed={0.35}
          noiseAmount={0.06}
          lightMode={true}
          style={{ opacity: 0.38, zIndex: 0 }}
        />

        {/* Left Column: Value Proposition & CTAs */}
        <div className="landing-hero-content">
          <div className="landing-pill">
            <Shield size={13} />
            <span>AI-Assisted Configuration Drift Detection</span>
          </div>

          <h1 id="hero-heading" className="landing-hero-title">
            Keep your infrastructure configuration in check.
          </h1>

          <p className="landing-hero-subtitle">
            Detect configuration drift across Kubernetes workloads, compare expected and actual settings down to the exact field, and investigate changes with AI-assisted explanations.
          </p>

          <div className="landing-hero-ctas">
            {/* React Bits StarBorder on the primary CTA */}
            <StarBorder
              as={Link}
              to="/dashboard"
              color="#537B60"
              speed="5s"
              theme="light"
              style={{ textDecoration: 'none' }}
              className="btn btn-primary btn-lg"
            >
              Open Live Dashboard
              <ArrowRight size={16} />
            </StarBorder>

            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              Explore Detection Engine
            </a>
          </div>

          <div className="landing-trust-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span>Deterministic SHA-256 Fingerprints</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span>IsolationForest Anomaly Scoring</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="var(--success)" />
              <span>Real Cluster + Fallback</span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Centerpiece */}
        <div className="landing-hero-visual">
          <InfrastructureDiagram />
        </div>
      </section>

      {/* ── Technology Ecosystem Strip with LogoLoop ── */}
      <section id="technology" className="landing-tech-strip" aria-label="Technology Ecosystem">
        <div className="landing-tech-header">
          <div className="landing-tech-subtitle">
            Engineered for Cloud Native Infrastructure &amp; Production Reliability
          </div>
        </div>
        <LogoLoop
          logos={TECH_LOGOS}
          speed={24}
          direction="left"
          logoHeight={34}
          gap={32}
          hoverSpeed={50}
          bgColor="#F4F2E9"
        />
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" className="landing-section">
        <div className="section-head">
          <span className="section-eyebrow">Detection Pipeline</span>
          <h2 className="section-title">How Configuration Drift Is Detected &amp; Resolved</h2>
          <p className="section-desc">
            Config Cop replaces brittle manual inspection with canonical JSON fingerprinting, unsupervised machine learning, and bounded AI analysis.
          </p>
        </div>

        <div className="workflow-steps-grid">
          <div className="workflow-step">
            <span className="workflow-step-num">Step 01</span>
            <h3 className="workflow-step-title">Baseline Capture</h3>
            <p className="workflow-step-desc">
              Canonical manifest definitions (CPU, memory, replica count, images, environment keys) are ingested from GitOps or live deployments and hashed into SHA-256 fingerprints.
            </p>
          </div>

          <div className="workflow-step">
            <span className="workflow-step-num">Step 02</span>
            <h3 className="workflow-step-title">Cluster State Audit</h3>
            <p className="workflow-step-desc">
              During each scan cycle, live manifests are retrieved from the Kubernetes API via <code>kubectl</code> and normalized to strip dynamic runtime metadata.
            </p>
          </div>

          <div className="workflow-step">
            <span className="workflow-step-num">Step 03</span>
            <h3 className="workflow-step-title">Exact Field Diffing</h3>
            <p className="workflow-step-desc">
              If live and baseline SHA-256 hashes diverge, a recursive field comparator isolates the exact drifted keys: expected value vs live actual value.
            </p>
          </div>

          <div className="workflow-step">
            <span className="workflow-step-num">Step 04</span>
            <h3 className="workflow-step-title">IsolationForest Outliers</h3>
            <p className="workflow-step-desc">
              An unsupervised <code>scikit-learn</code> IsolationForest evaluates workload feature vectors to flag multi-dimensional drift anomalies without manual rules.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features & Architecture ── */}
      <section id="architecture" className="landing-section" style={{ paddingTop: 0 }}>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Eye size={22} />
            </div>
            <h3 className="feature-card-title">Precise Diff Inspector</h3>
            <p className="feature-card-text">
              View every drifted property with side-by-side expected and actual values. Diffs clearly display image tag shifts, replica count changes, and CPU/memory threshold modifications.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Sparkles size={22} />
            </div>
            <h3 className="feature-card-title">AI Root-Cause Diagnosis</h3>
            <p className="feature-card-text">
              Provides context-aware hypotheses on likely causes, risk assessment, and recommended remediation. If the LLM is unreachable, deterministic rule-based fallbacks guarantee uninterrupted operation.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Lock size={22} />
            </div>
            <h3 className="feature-card-title">Bounded Remediation Guardrails</h3>
            <p className="feature-card-text">
              AI produces text explanations only — remediation commands are never hallucinated. Reversions are computed strictly against the verified baseline and re-validated with a post-apply scan.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Layers size={22} />
            </div>
            <h3 className="feature-card-title">Historical Incident Matching</h3>
            <p className="feature-card-text">
              Stores incident resolutions in SQLite and computes TF-IDF similarity vectors to identify recurring configuration regressions and display verified fixes from previous incidents.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Terminal size={22} />
            </div>
            <h3 className="feature-card-title">Direct Cluster Operations</h3>
            <p className="feature-card-text">
              Scale deployments, monitor rollout progression, inject controlled test drift, and reset demo states directly through the interface with live operation status tracking.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Activity size={22} />
            </div>
            <h3 className="feature-card-title">Honest Environment Reporting</h3>
            <p className="feature-card-text">
              No fake telemetry. The dashboard explicitly declares whether it is connected to a live Kubernetes cluster or running the local simulated engine, and displays true AI API connectivity states.
            </p>
          </div>
        </div>
      </section>

      {/* ── Security & Safety Boundary ── */}
      <section id="security" className="landing-section" style={{ paddingTop: 0 }}>
        <div className="surface" style={{ padding: '36px 32px', background: 'rgba(255,255,255,0.92)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--honeydew)', display: 'grid', placeItems: 'center', color: 'var(--forest)' }}>
              <Lock size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, color: 'var(--forest)', fontWeight: 700 }}>Security &amp; Air-Gap Boundary Architecture</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>How Config Cop protects production infrastructure from unverified automated changes</p>
            </div>
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 20 }}>
            Large language models are inherently non-deterministic. In mission-critical Kubernetes environments, granting an AI engine write access to execute arbitrary shell commands or generate ad-hoc patches introduces severe security vulnerabilities.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="surface-cream" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>1. Read-Only AI Reasoning</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                The AI model receives only sanitized diff summaries. It outputs narrative explanations and recommendations; it never executes commands.
              </p>
            </div>
            <div className="surface-cream" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>2. Deterministic Baseline Revert</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                When you click "Fix", the backend applies exact JSON patches extracted directly from the verified baseline, not AI generated YAML.
              </p>
            </div>
            <div className="surface-cream" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>3. Post-Patch Fingerprint Proof</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Every fix immediately re-queries the cluster via <code>kubectl</code> and calculates a fresh SHA-256 hash. If it does not equal the baseline hash, the fix is flagged as failed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA Banner ── */}
      <section className="landing-cta-banner">
        <div className="landing-cta-card">
          <h2 className="landing-cta-title">Ready to audit your Kubernetes workloads?</h2>
          <p className="landing-cta-subtitle">
            Inspect live deployments, detect unauthorized configuration changes, and restore baseline reliability in seconds.
          </p>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            <Link to="/dashboard" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
              Open Dashboard
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="landing-brand-icon" style={{ width: 26, height: 26, borderRadius: 6 }} aria-hidden="true">
              <Shield size={14} color="#FFFFFF" />
            </div>
            <span style={{ fontWeight: 700, color: 'var(--forest)' }}>Config Cop</span>
            <span>· AI-Assisted Configuration Drift Detector</span>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/dashboard" style={{ color: 'var(--text-secondary)' }}>Dashboard</Link>
            <Link to="/dashboard/workloads" style={{ color: 'var(--text-secondary)' }}>Workloads</Link>
            <Link to="/dashboard/drift" style={{ color: 'var(--text-secondary)' }}>Drift Analysis</Link>
            <Link to="/dashboard/incidents" style={{ color: 'var(--text-secondary)' }}>Incidents</Link>
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Hackathon PS08 Demo · Deterministic Infrastructure Intelligence
          </div>
        </div>
      </footer>
    </div>
  )
}
