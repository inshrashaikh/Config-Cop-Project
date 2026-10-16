# Config Cop — AI-Assisted Configuration Drift Detector (PS08)

Hackathon demo. Reads **real Kubernetes Deployments** via `kubectl`, fingerprints their live
config, detects drift against a saved baseline, finds outliers with **scikit-learn**, explains the
drift in plain language via a **real OpenAI-compatible LLM API**, remembers past incidents/fixes,
and **fixes the real Deployment** by patching it back to baseline and re-reading it to verify.

**Honest by design — no silent simulation:**
- Cluster status is shown live: `LIVE · <context>` / `SIMULATED` (with the reason) / `UNAVAILABLE`.
- `CLUSTER_MODE=real` requires a cluster; if none is reachable the API returns a clear error.
- AI status is shown (`CONNECTED` / `ERROR <reason>` / `not configured`). If the AI call fails,
  the text is labelled **rule-based — NOT AI**, never presented as AI output.

---

## Quick start (real Minikube cluster)

```bash
# 1) start a cluster + deploy the 5 demo workloads
minikube start
kubectl apply -f k8s/demo-workloads.yaml
kubectl get deploy -n prod            # wait until all READY

# 2) backend (FastAPI) — talks to the cluster via kubectl
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# 3) frontend (React + Vite + Tailwind)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** → the header shows `K8s: LIVE · minikube`.

### Demo flow
1. **⚡ Inject Sample Drift** → patches the real Deployments (kubectl patch) and cards turn **DRIFTED**.
2. **🔍 Scan for Drift** → exact **expected vs actual** values, the AI explanation, IsolationForest
   outlier score, and the incident recorded.
3. **🩹 Fix (restore baseline)** → patches the real Deployment back to baseline, **re-reads it** and
   reports **"Fix verified"**.
4. Inject again + Scan → the recurring problem is matched to the **past incident** (e.g. *64% match → fix …*).
5. **Cluster Ops** +/− scales a real Deployment (kubectl) and shows rollout status; **↺ Reset Demo**
   re-applies `k8s/demo-workloads.yaml` and re-captures the baseline.

### Modes
- `CLUSTER_MODE=auto` (default): live when a kubectl context exists, otherwise an explicitly-labelled
  simulation. `real`: require live (error if unavailable). `simulated`: force the fallback.
- `CONFIGCOP_NAMESPACE` (default `prod`), `CONFIGCOP_MANIFEST` (default `k8s/demo-workloads.yaml`).
- Baseline lives in `backend/data/baseline-live.json`. First read captures it; `/api/baseline/capture`
  or **Reset Demo** re-captures it from the current cluster.

---

## AI explanations (real API)

Keys are **server-side only** and never sent to the browser. Any OpenAI-compatible
provider works, plus Google's official **Gemini** API:

```bash
cp .env.example .env
# Groq (open-weight Llama) example:
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
LLM_API_KEY=gsk_xxx

# --- or Google Gemini (Generative Language API) ---
# LLM_PROVIDER=gemini
# LLM_MODEL=gemini-3.5-flash-lite    # fast + reliable; gemini-3.5-flash also works
# LLM_API_KEY=AIza_xxx              # Google AI Studio key
# LLM_BASE_URL is optional; it defaults to https://generativelanguage.googleapis.com/v1beta
```

> Tip: if a Gemini model returns `HTTP 503 (high demand)`, switch `LLM_MODEL` to another
> available model such as `gemini-3.5-flash-lite` or `gemini-3.5-flash`. The app reports this
> error explicitly and keeps using the labelled rule-based fallback in the meantime.

The backend **loads `.env` automatically** on startup (process environment variables always
win). Then the header shows `AI: CONNECTED · gemini/gemini-3.8-flash`. Use the
**🔌 Test AI** button (or `POST /api/llm/test`) to verify connectivity; errors are shown
explicitly. With no provider configured, explanations are **rule-based** and clearly labelled
as such.

**Verify the real API yourself** (this makes actual calls; exit code 0 = verified):

```bash
python scripts/verify_ai.py
```

Safety: the AI returns **text only**. Fixes are computed and validated server-side against the
baseline; a proposed fix that doesn't reproduce the baseline exactly is rejected (`HTTP 422`).
No commands are ever executed by the model.

### Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest tests -q          # mocked; no real API key or cluster needed
```

---

## Docker (both services)

```bash
docker compose up --build
# dashboard:  http://localhost:8080   (nginx proxies /api to the backend)
# API docs:   http://localhost:8001/docs
```

Docker runs the backend with `CLUSTER_MODE=simulated` (a container can't reach your host Minikube
kubeconfig by default), so the UI honestly reports `SIMULATED`. For **live** cluster ops, run the
backend locally (Quick start above). To try live from a container, mount your kubeconfig and set
`CLUSTER_MODE`:

```bash
docker compose run -e CLUSTER_MODE=auto -v %USERPROFILE%\.kube:/root/.kube backend
```

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | workloads, fingerprints, rollouts, incidents, meta |
| GET | `/api/cluster/status` | kubectl connectivity + mode (live/simulated/unavailable) |
| GET | `/api/llm/status?check=true` · POST `/api/llm/test` | AI provider status + real connectivity test |
| GET | `/api/baseline` · POST `/api/baseline/capture` | saved baseline / snapshot current cluster |
| POST | `/api/scan` | drift diff, IsolationForest outliers, explanations, incident matching |
| POST | `/api/drift/introduce` | inject drift (real kubectl patch, or simulated) |
| POST | `/api/fix` | patch Deployment back to baseline, re-read + verify (or validate a proposed fix) |
| GET | `/api/incidents` | SQLite incident history |
| POST | `/api/scale` · GET `/api/rollout/{name}` | real replica scaling + rollout status |
| POST | `/api/reset` | re-apply pristine manifest + re-capture baseline (or reset simulation) |

## Layout

```
backend/app/   k8s.py      (live kubectl reads/patches + rollout, or labelled simulation)
               cluster.py  (live/simulated provider: baseline, drift injection, fix+verify)
               state.py    (config shape, fingerprints, drift recipes)
               drift.py    (baseline diff + IsolationForest)
               llm.py      (real OpenAI-compatible API + status/test + rule-based fallback)
               config.py   (dependency-free .env loader)
               incidents.py(SQLite + TF-IDF similarity)
               main.py     (FastAPI routes)
backend/tests/ test_llm.py, test_api.py, test_config.py  (mocked; pytest)
scripts/       demo.ps1, verify_ai.py (real-provider verification)
frontend/src/  App.jsx, api.js  (Tailwind dashboard)
k8s/           demo-workloads.yaml (5 deployments), config-cop.yaml (the app)
```
