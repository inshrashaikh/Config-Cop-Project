"""Config Cop API — AI-assisted configuration drift detector (hackathon demo).

Live: real Kubernetes Deployments via kubectl (config read, drift, patch-to-baseline fix),
      real scale/rollout, and a real OpenAI-compatible LLM API when configured.
Honest fallback: when no cluster is reachable the app says so (never silently pretends).
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import cluster, incidents, k8s, llm, state
from .drift import detect_drift, detect_outliers, diff_configs

app = FastAPI(title="Config Cop API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScaleBody(BaseModel):
    workload: str
    replicas: int = Field(ge=0, le=50)


class InjectBody(BaseModel):
    workload: str | None = None
    count: int | None = Field(default=None, ge=1, le=5)


class FixBody(BaseModel):
    workload: str
    proposedChanges: list[dict[str, Any]] | None = None


@app.exception_handler(cluster.ClusterUnavailable)
async def _cluster_unavailable(request, exc):  # noqa: ANN001
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={"error": "cluster_unavailable", "detail": exc.detail})


def _meta() -> dict[str, Any]:
    cs = cluster.status()
    return {
        "cluster": cs,
        "llm": llm.provider_info(),
        "storage": {"engine": "sqlite", "path": str(incidents.DB_PATH)},
        "detector": "scikit-learn IsolationForest + exact baseline diff",
        "explainSource": "AI when connected, otherwise rule-based fallback (always labelled)",
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "time": time.time(), "meta": _meta()}


@app.get("/api/meta")
def meta() -> dict[str, Any]:
    return _meta()


@app.get("/api/cluster/status")
def cluster_status(force: bool = False) -> dict[str, Any]:
    if force:
        k8s.reset_cache()
    return cluster.status()


@app.get("/api/llm/status")
def llm_status(check: bool = Query(default=False, description="perform a real connectivity test")) -> dict[str, Any]:
    info = llm.provider_info()
    if check:
        return {**info, "test": llm.test_connection()}
    return {**info, "test": None}


@app.post("/api/llm/test")
def llm_test() -> dict[str, Any]:
    return llm.test_connection()


@app.get("/api/status")
def status() -> dict[str, Any]:
    wls = cluster.workloads()
    try:
        rollouts = k8s.overview(wls)
    except Exception as exc:
        rollouts = [{"workload": w["name"], "status": "Unknown", "reason": str(exc)[:200], "error": True} for w in wls]
    return {
        "meta": _meta(),
        "workloads": wls,
        "rollouts": rollouts,
        "incidents": incidents.list_incidents(50),
        "incidentsOpen": [i for i in incidents.list_incidents(200) if i["status"] == "open"],
    }


@app.get("/api/baseline")
def baseline() -> dict[str, Any]:
    bl = cluster.baseline_dict()
    return {
        "baseline": {name: {"config": cfg, "fingerprint": state.fingerprint(cfg)} for name, cfg in bl.items()},
        "clusterMode": cluster.mode(),
    }


@app.post("/api/baseline/capture")
def capture_baseline() -> dict[str, Any]:
    result = cluster.capture_baseline()
    return {**result, "note": "Current live Deployment configs saved as the approved baseline.",
            "clusterMode": cluster.mode()}


@app.post("/api/scan")
def scan() -> dict[str, Any]:
    wls = cluster.workloads()
    baseline = cluster.baseline_dict()
    drift = detect_drift(wls, baseline)
    outliers = detect_outliers(wls, baseline)
    outlier_names = {r["workload"] for r in outliers["results"] if r["isOutlier"]}

    explanations: dict[str, Any] = {}
    matched: dict[str, list] = {}
    new_incidents: list[int] = []
    ai_errors: list[dict[str, Any]] = []

    for d in drift:
        name = d["workload"]
        d["clusterMode"] = cluster.mode()
        if not d["drifted"]:
            continue
        exp = llm.explain(name, d["diffs"], sorted(outlier_names & {name}))
        explanations[name] = exp
        matched[name] = incidents.match_similar(d["diffs"], name)
        if exp.get("aiError"):
            ai_errors.append({"workload": name, "error": exp["aiError"], "type": exp.get("errorType")})

        paths = {x["path"] for x in d["diffs"]}
        existing = incidents.open_incident_for(name, paths)
        if existing:
            incidents.refresh_incident(
                int(existing["id"]), workload=name, explanation=exp["explanation"],
                explain_source=exp.get("source", ""), likely_cause=exp["likelyCause"],
                changes=d["diffs"], fingerprint=d["fingerprint"],
                baseline_fingerprint=d["baselineFingerprint"])
            d["incidentId"] = existing["id"]
        else:
            inc_id = incidents.create_incident(
                workload=name, changes=d["diffs"], explanation=exp["explanation"],
                likely_cause=exp["likelyCause"], fingerprint=d["fingerprint"],
                baseline_fingerprint=d["baselineFingerprint"],
                explain_source=exp.get("source", ""))
            new_incidents.append(inc_id)
            d["incidentId"] = inc_id

    summary = {
        "scannedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "total": len(drift),
        "drifted": [d["workload"] for d in drift if d["drifted"]],
        "healthy": [d["workload"] for d in drift if not d["drifted"]],
        "outliers": sorted(outlier_names),
        "newIncidents": new_incidents,
        "clusterMode": cluster.mode(),
        "llmMode": _meta()["llm"]["mode"],
        "aiErrors": ai_errors,
    }
    return {
        "summary": summary, "drift": drift, "outliers": outliers,
        "explanations": explanations, "matchedIncidents": matched,
        "workloads": cluster.workloads(), "incidents": incidents.list_incidents(50), "meta": _meta(),
    }


@app.post("/api/drift/introduce")
def introduce(body: InjectBody | None = None) -> dict[str, Any]:
    body = body or InjectBody()
    try:
        return cluster.inject_drift(body.workload, body.count)
    except KeyError:
        raise HTTPException(404, f"workload {body.workload!r} not found in cluster/baseline")


@app.post("/api/fix")
def fix(body: FixBody) -> dict[str, Any]:
    name = body.workload
    mode = cluster.mode()
    baseline = cluster.baseline_dict()
    if name not in baseline:
        raise HTTPException(404, f"workload {name!r} not found")

    # Validate any client/AI-proposed fix against the baseline before applying it.
    if body.proposedChanges:
        configs = cluster.configs()
        current = configs.get(name) or {}
        candidate = _apply_paths(current, body.proposedChanges)
        remaining = diff_configs(candidate, baseline[name])
        if remaining:
            raise HTTPException(422, detail={
                "error": "Proposed fix rejected: does not reproduce the baseline exactly.",
                "remainingDifferences": remaining[:10],
            })

    try:
        result = cluster.fix(name)
    except KeyError:
        raise HTTPException(404, f"workload {name!r} not found")

    wls = cluster.workloads()
    drift_after = detect_drift(wls, cluster.baseline_dict())
    still = [d for d in drift_after if d["workload"] == name and d["drifted"]]
    result["rescan"] = {"stillDrifted": bool(still), "healthy": not still and result.get("verified", False)}
    result["clusterMode"] = mode
    result["workloads"] = wls
    result["incidents"] = incidents.list_incidents(50)
    result["meta"] = _meta()
    return result


@app.get("/api/incidents")
def get_incidents(limit: int = 50) -> dict[str, Any]:
    items = incidents.list_incidents(min(limit, 200))
    return {"incidents": items, "count": len(items), "engine": "sqlite"}


@app.post("/api/scale")
def scale(body: ScaleBody) -> dict[str, Any]:
    configs = cluster.configs()
    if body.workload not in configs:
        raise HTTPException(404, f"workload {body.workload!r} not found")
    spec_replicas = configs[body.workload].get("replicas", 1)
    try:
        result = k8s.scale(body.workload, body.replicas, spec_replicas)
        result["rollout"] = k8s.rollout_status(body.workload, spec_replicas)
    except Exception as exc:
        raise HTTPException(502, f"scale failed: {exc}")
    result["clusterMode"] = cluster.mode()
    return result


@app.get("/api/rollout/{workload}")
def rollout(workload: str) -> dict[str, Any]:
    configs = cluster.configs()
    if workload not in configs:
        raise HTTPException(404, f"workload {workload!r} not found")
    return k8s.rollout_status(workload, configs[workload].get("replicas", 1))


@app.post("/api/reset")
def reset() -> dict[str, Any]:
    result = cluster.reset_demo()
    result["meta"] = _meta()
    result["workloads"] = cluster.workloads()
    return result


def _apply_paths(config: dict[str, Any], changes: list[dict[str, Any]]) -> dict[str, Any]:
    import copy

    out = copy.deepcopy(config)
    for ch in changes:
        path = str(ch.get("path", ""))
        parts = path.split(".")
        node = out
        for p in parts[:-1]:
            if not isinstance(node, dict) or p not in node:
                raise HTTPException(422, f"Proposed fix references unknown path {path!r}")
            node = node[p]
        if not isinstance(node, dict) or parts[-1] not in node:
            raise HTTPException(422, f"Proposed fix references unknown path {path!r}")
        if "value" not in ch:
            raise HTTPException(422, f"Proposed change missing 'value': {ch!r}")
        node[parts[-1]] = ch["value"]
    return out
