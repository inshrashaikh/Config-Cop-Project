"""Auto-scaling recommendations (rule-based, fully explainable).

Every recommendation carries the rule that fired and the numbers behind it, so
the UI can show *why* a workload should scale — nothing is a black box. Applying
a recommendation uses the same real kubectl scale path as the manual buttons.
"""
from __future__ import annotations

import time
from typing import Any

from . import activity, cluster, k8s
from .drift import detect_drift, detect_outliers

MIN_REPLICAS = 0
MAX_REPLICAS = 20


def recommendations() -> dict[str, Any]:
    """One recommendation per workload: current vs suggested replicas + rule(s)."""
    wls = cluster.workloads()
    baseline = cluster.baseline_dict()
    drift = detect_drift(wls, baseline)
    drift_by = {d["workload"]: d for d in drift}
    outliers = detect_outliers(wls, baseline)["results"]

    rollouts = {r["workload"]: r for r in k8s.overview(wls)}

    recs: list[dict[str, Any]] = []
    for w in wls:
        name = w["name"]
        current = int(w["config"].get("replicas", 1))
        base_replicas = int((baseline.get(name) or {}).get("replicas", current))
        rollout = rollouts.get(name, {})
        available = rollout.get("availableReplicas")
        outlier = next((o for o in outliers if o["workload"] == name), {})
        drifted = drift_by.get(name, {}).get("drifted", False)

        rules: list[dict[str, Any]] = []
        suggested = current

        # Rule 1 — replicas themselves drifted: restoring the baseline is the fix.
        if drift_by.get(name, {}).get("drifted"):
            for d in drift_by[name]["diffs"]:
                if d["path"] == "replicas":
                    rules.append({
                        "id": "replica-drift",
                        "why": f"replicas drifted from baseline ({d['expected']} → {d['actual']})",
                        "action": "down" if int(d["actual"]) > int(d["expected"]) else "up",
                        "to": int(d["expected"]),
                        "severity": "high",
                    })
                    suggested = int(d["expected"])

        # Rule 2 — pod not fully available: scale up so capacity matches demand.
        if isinstance(available, int) and available < current and not any(
                r["id"] == "replica-drift" for r in rules):
            rules.append({
                "id": "availability",
                "why": f"only {available}/{current} replicas available right now",
                "action": "up", "to": min(MAX_REPLICAS, current + 1), "severity": "medium",
            })
            suggested = min(MAX_REPLICAS, current + 1)

        # Rule 3 — strong statistical outlier + drift: extra replica for safety headroom.
        if outlier.get("isOutlier") and drifted and outlier.get("anomalyScore", 0) > 0.55 \
                and not rules:
            rules.append({
                "id": "outlier-headroom",
                "why": (f"IsolationForest flags this as an outlier (score {outlier.get('anomalyScore')}) "
                        "while drifted — keep headroom until the drift is fixed"),
                "action": "up", "to": min(MAX_REPLICAS, current + 1), "severity": "low",
            })
            suggested = min(MAX_REPLICAS, current + 1)

        recs.append({
            "workload": name,
            "currentReplicas": current,
            "baselineReplicas": base_replicas,
            "suggestedReplicas": suggested,
            "action": ("up" if suggested > current else "down" if suggested < current else "none"),
            "rules": rules,
            "drifted": drifted,
            "anomalyScore": outlier.get("anomalyScore"),
            "availableReplicas": available,
            "applyVia": "real kubectl scale" if cluster.mode() == "live" else "SIMULATED scale",
        })

    recs.sort(key=lambda r: (r["action"] == "none", -len(r["rules"])))
    return {
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "clusterMode": cluster.mode(),
        "bounds": {"min": MIN_REPLICAS, "max": MAX_REPLICAS},
        "recommendations": recs,
        "toApply": [r for r in recs if r["action"] != "none"],
        "note": "Rule-based (every rule is shown). Applying uses the same validated kubectl scale as the manual buttons.",
    }


def apply(workload: str, replicas: int) -> dict[str, Any]:
    configs = cluster.configs()
    if workload not in configs:
        raise KeyError(workload)
    replicas = max(MIN_REPLICAS, min(MAX_REPLICAS, int(replicas)))
    spec_replicas = configs[workload].get("replicas", 1)
    result = k8s.scale(workload, replicas, spec_replicas)
    result["rollout"] = k8s.rollout_status(workload, replicas)
    result["clusterMode"] = cluster.mode()
    result["source"] = "auto-scale"
    activity.log("scale.change",
                 f"Auto-scale set {workload} to {replicas} replica(s) — "
                 f"{'real kubectl rollout' if cluster.mode() == 'live' else 'SIMULATED rollout'}",
                 workload=workload, level="success",
                 details={"replicas": replicas, "mode": cluster.mode()})
    return result
