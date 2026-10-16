import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, ArrowRight, CheckCircle2, GitBranch, Cpu,
  Sparkles, Terminal, Layers, Lock, Activity, Eye, Zap,
  CheckCircle, Server, ShieldCheck, FileCheck2, Hash
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
    { id: 'fastapi', node: <div className="tech-icon-item"><SiFastapi color="#059669" size={18} /><span>FastAPI</span></div> },
    { id: 'python', node: <div className="tech-icon-item"><SiPython color="#3776AB" size={18} /><span>Python 3.12</span></div> },
    { id: 'react', node: <div className="tech-icon-item"><SiReact color="#087EA4" size={18} /><span>React 18</span></div> },
    { id: 'linux', node: <div className="tech-icon-item"><SiLinux color="#243129" size={18} /><span>Linux</span></div> },
    { id: 'prometheus', node: <div className="tech-icon-item"><SiPrometheus color="#E6522C" size={18} /><span>Prometheus</span></div> },
    { id: 'github', node: <div className="tech-icon-item"><SiGithub color="#243129" size={18} /><span>GitOps</span></div> },
    { id: 'sqlite', node: <div className="tech-icon-item"><SiSqlite color="#003B57" size={18} /><span>SQLite</span></div> },
  ]

  const fadeIn = {
    initial: { opacity: 0, y: 16 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }

  return (
    <div className="landing-page">
      {/* Living Ambient Mesh Background */}
      <div className="app-living-bg" aria-hidden="true" />

      {/* Accessible Skip Link */}
      <a href="#hero-heading" className="skip-link">
        Skip to main content
      </a>

      {/* ── Fixed Navigation Bar ── */}
      <div className="landing-nav-wrapper">
        <header className="landing-nav" role="banner">
          <Link to="/" className="landing-brand" aria-label="Config Cop Home">
            <div className="landing-brand-icon" aria-hidden="true">
              <Shield size={17} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <div>
              <div className="landing-brand-text">Config Cop</div>
            </div>
          </Link>

          <nav className="landing-nav-links" aria-label="Main Navigation">
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#technology" className="landing-nav-link">Technology</a>
            <a href="#features" className="landing-nav-link">Capabilities</a>
            <a href="#security" className="landing-nav-link">Security Boundary</a>
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link
              to="/dashboard"
              className="btn btn-primary"
              style={{ textDecoration: 'none', height: 38, padding: '0 18px' }}
            >
              <span>Launch Console</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </header>
      </div>

      {/* ── Hero Section with LightRays ── */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <LightRays
          raysOrigin="top-center"
          raysColor="#4D7459"
          lightSpread={2.2}
          raysSpeed={0.3}
          noiseAmount={0.05}
          lightMode={true}
          style={{ opacity: 0.3, zIndex: 0 }}
        />

        {/* Left Column: Value Proposition & CTAs */}
        <motion.div
          className="landing-hero-content"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="landing-pill">
            <Shield size={13} color="var(--forest)" />
            <span>AI-Assisted Kubernetes Drift Governance</span>
          </div>

          <h1 id="hero-heading" className="landing-hero-title">
            Keep your infrastructure configuration in check.
          </h1>

          <p className="landing-hero-subtitle">
            Audit live Kubernetes workloads against verified GitOps baselines, detect configuration drift down to the exact field, and investigate changes with bounded, trustworthy AI root-cause analysis.
          </p>

          <div className="landing-hero-ctas">
            <StarBorder
              as={Link}
              to="/dashboard"
              color="#2E6048"
              speed="6s"
              theme="light"
              style={{ textDecoration: 'none' }}
              className="btn btn-primary btn-lg"
            >
              <span>Open Live Console</span>
              <ArrowRight size={16} />
            </StarBorder>

            <a href="#how-it-works" className="btn btn-secondary btn-lg">
              Explore Detection Engine
            </a>
          </div>

          <div className="landing-trust-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--success-solid)" />
              <span>SHA-256 Canonical Fingerprints</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--success-solid)" />
              <span>IsolationForest Anomaly Scoring</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={15} color="var(--success-solid)" />
              <span>Bounded AI Remediation</span>
            </div>
          </div>
        </motion.div>

        {/* Right Column: Visual Centerpiece */}
        <motion.div
          className="landing-hero-visual"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        >
          <InfrastructureDiagram />
        </motion.div>
      </section>

      {/* ── Technology Ecosystem Strip with LogoLoop ── */}
      <section id="technology" className="landing-tech-strip" aria-label="Technology Ecosystem">
        <div className="landing-tech-header">
          <div className="landing-tech-subtitle">
            Engineered for Cloud Native Production Reliability
          </div>
        </div>
        <LogoLoop
          logos={TECH_LOGOS}
          speed={26}
          direction="left"
          logoHeight={34}
          gap={24}
          hoverSpeed={55}
          bgColor="#F4F2E9"
        />
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" className="landing-section">
        <motion.div className="section-head" {...fadeIn}>
          <span className="section-eyebrow">Detection Pipeline</span>
          <h2 className="section-title">How Configuration Drift Is Detected &amp; Resolved</h2>
          <p className="section-desc">
            Config Cop replaces brittle manual inspection with canonical JSON fingerprinting, unsupervised machine learning, and bounded AI analysis.
          </p>
        </motion.div>

        <div className="workflow-steps-grid">
          {[
            {
              step: 'Step 01',
              title: 'Baseline Capture',
              desc: 'Canonical manifest definitions (CPU, memory, replica count, images, environment keys) are ingested from GitOps or live deployments and hashed into SHA-256 fingerprints.',
            },
            {
              step: 'Step 02',
              title: 'Cluster State Audit',
              desc: 'During each scan cycle, live manifests are retrieved from the Kubernetes API via kubectl and normalized to strip dynamic runtime metadata.',
            },
            {
              step: 'Step 03',
              title: 'Exact Field Diffing',
              desc: 'If live and baseline SHA-256 hashes diverge, a recursive field comparator isolates the exact drifted keys: expected value vs live actual value.',
            },
            {
              step: 'Step 04',
              title: 'IsolationForest Outliers',
              desc: 'An unsupervised scikit-learn IsolationForest evaluates workload feature vectors to flag multi-dimensional drift anomalies without manual rules.',
            },
          ].map((item, idx) => (
            <motion.div
              key={item.step}
              className="workflow-step"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="workflow-step-num">{item.step}</span>
              <h3 className="workflow-step-title">{item.title}</h3>
              <p className="workflow-step-desc">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features Bento Grid ── */}
      <section id="features" className="landing-section" style={{ paddingTop: 0 }}>
        <motion.div className="section-head" {...fadeIn}>
          <span className="section-eyebrow">Enterprise Capabilities</span>
          <h2 className="section-title">Engineered for Infrastructure Transparency</h2>
          <p className="section-desc">
            Deterministic configuration validation paired with air-gapped machine learning and honest environment telemetry.
          </p>
        </motion.div>

        <div className="features-bento-grid">
          <motion.div className="bento-card span-2" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Eye size={22} />
            </div>
            <h3 className="feature-card-title">Precise Two-Column Diff Inspector</h3>
            <p className="feature-card-text">
              Inspect drifted properties with clean side-by-side expected and actual values. Diffs clearly isolate container image tag shifts, replica count modifications, and CPU/memory threshold divergences without visual clutter.
            </p>
          </motion.div>

          <motion.div className="bento-card" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Sparkles size={22} />
            </div>
            <h3 className="feature-card-title">AI Root-Cause Diagnosis</h3>
            <p className="feature-card-text">
              Context-aware hypotheses on likely causes, risk assessment, and recommended remediation. If the LLM is unreachable, deterministic rule-based fallbacks guarantee uninterrupted operation.
            </p>
          </motion.div>

          <motion.div className="bento-card" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Lock size={22} />
            </div>
            <h3 className="feature-card-title">Air-Gapped Remediation</h3>
            <p className="feature-card-text">
              AI produces text explanations only — remediation commands are never hallucinated. Reversions are computed strictly against the verified baseline and re-validated with a post-apply scan.
            </p>
          </motion.div>

          <motion.div className="bento-card span-2" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Layers size={22} />
            </div>
            <h3 className="feature-card-title">Historical Incident Similarity (TF-IDF)</h3>
            <p className="feature-card-text">
              Persists incident resolutions in SQLite and computes TF-IDF similarity vectors to identify recurring configuration regressions and display verified fixes from previous incidents across your cluster history.
            </p>
          </motion.div>

          <motion.div className="bento-card" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Terminal size={22} />
            </div>
            <h3 className="feature-card-title">Direct Cluster Operations</h3>
            <p className="feature-card-text">
              Scale deployments, monitor rollout progression, inject controlled test drift, and reset demo states directly through the interface with live operation status tracking.
            </p>
          </motion.div>

          <motion.div className="bento-card span-2" {...fadeIn}>
            <div className="feature-icon-wrapper">
              <Activity size={22} />
            </div>
            <h3 className="feature-card-title">Honest Environment Reporting</h3>
            <p className="feature-card-text">
              No simulated smoke and mirrors disguised as live data. The console explicitly declares whether it is connected to a live Kubernetes cluster or running the local simulated engine, and displays true AI API connectivity states.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Security & Safety Boundary ── */}
      <section id="security" className="landing-section" style={{ paddingTop: 0 }}>
        <motion.div
          className="surface"
          style={{
            padding: '36px 32px',
            background: 'rgba(255, 255, 255, 0.95)',
            boxShadow: 'var(--elev-2)'
          }}
          {...fadeIn}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--honeydew)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--forest)',
              border: '1px solid var(--sage-mid)',
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 'var(--text-xl)', color: 'var(--forest)', fontWeight: 800 }}>
                Security &amp; Air-Gap Boundary Architecture
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                How Config Cop protects production infrastructure from unverified automated changes
              </p>
            </div>
          </div>

          <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 24, maxWidth: '78ch' }}>
            Large language models are inherently non-deterministic. In mission-critical Kubernetes environments, granting an AI engine write access to execute arbitrary shell commands or generate ad-hoc patches introduces severe security vulnerabilities.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <div className="surface-cream" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>
                <FileCheck2 size={16} />
                <span>1. Read-Only AI Reasoning</span>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                The AI model receives only sanitized diff summaries. It outputs narrative explanations and recommendations; it never executes commands.
              </p>
            </div>
            <div className="surface-cream" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>
                <Lock size={16} />
                <span>2. Deterministic Baseline Revert</span>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                When you click "Fix", the backend applies exact JSON patches extracted directly from the verified baseline, not AI generated YAML.
              </p>
            </div>
            <div className="surface-cream" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--forest)', marginBottom: 6 }}>
                <Hash size={16} />
                <span>3. Post-Patch Fingerprint Proof</span>
              </div>
              <p style={{ fontSize: 'var(--text-caption)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Every fix immediately re-queries the cluster via <code>kubectl</code> and calculates a fresh SHA-256 hash. If it does not equal the baseline hash, the fix is flagged as failed.
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Final CTA Banner ── */}
      <section className="landing-cta-banner">
        <motion.div className="landing-cta-card" {...fadeIn}>
          <h2 className="landing-cta-title">Ready to audit your Kubernetes workloads?</h2>
          <p className="landing-cta-subtitle">
            Inspect live deployments, detect unauthorized configuration changes, and restore baseline reliability in seconds.
          </p>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            <Link to="/dashboard" className="btn btn-primary btn-lg" style={{ textDecoration: 'none' }}>
              <span>Open Dashboard Console</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer" role="contentinfo">
        <div className="landing-footer-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="landing-brand-icon" style={{ width: 26, height: 26, borderRadius: 7 }} aria-hidden="true">
              <Shield size={14} color="#FFFFFF" />
            </div>
            <span style={{ fontWeight: 800, color: 'var(--forest)', fontSize: 'var(--text-sm)' }}>Config Cop</span>
            <span style={{ color: 'var(--text-secondary)' }}>· AI-Assisted Configuration Drift Detector</span>
          </div>

          <div style={{ display: 'flex', gap: 20 }}>
            <Link to="/dashboard" style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}>Dashboard</Link>
            <Link to="/dashboard/workloads" style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}>Workloads</Link>
            <Link to="/dashboard/drift" style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}>Drift Analysis</Link>
            <Link to="/dashboard/incidents" style={{ color: 'var(--text-secondary)', fontWeight: 500, textDecoration: 'none' }}>Incidents</Link>
          </div>

          <div style={{ fontSize: 'var(--text-micro)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            PS08 Demo · Security-Grade Infrastructure Governance
          </div>
        </div>
      </footer>
    </div>
  )
}
