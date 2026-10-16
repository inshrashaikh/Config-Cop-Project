"""Drift detection: exact field diffs vs baseline + IsolationForest outlier scoring."""
from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

LOG_LEVELS = {"debug": 0, "info": 1, "warn": 2, "warning": 2, "error": 3}


def _cpu_m(v: str) -> float:
    v = str(v)
    if v.endswith("m"):
        return float(v[:-1])
    return float(v) * 1000


def _mem_mi(v: str) -> float:
    v = str(v)
    if v.endswith("Gi"):
        return float(v[:-2]) * 1024
    if v.endswith("Mi"):
        return float(v[:-2])
    if v.endswith("Ki"):
        return float(v[:-2]) / 1024
    return float(v) / (1024 * 1024)


def feature_vector(cfg: dict[str, Any]) -> dict[str, float]:
    """Numeric feature vector used for unsupervised outlier detection."""
    env = cfg.get("env", {})
    res = cfg.get("resources", {})
    tag = str(cfg.get("image", "")).rsplit(":", 1)[-1]
    parts = [int("".join(ch for ch in p if ch.isdigit()) or 0) for p in tag.split(".")]
    while len(parts) < 3:
        parts.append(0)
    return {
        "replicas": float(cfg.get("replicas", 0)),
        "cpu_request_m": _cpu_m(res.get("requests", {}).get("cpu", "0")),
        "cpu_limit_m": _cpu_m(res.get("limits", {}).get("cpu", "0")),
        "mem_request_mi": _mem_mi(res.get("requests", {}).get("memory", "0")),
        "mem_limit_mi": _mem_mi(res.get("limits", {}).get("memory", "0")),
        "env_count": float(len(env)),
        "db_pool_size": float(env.get("DB_POOL_SIZE", 0) or 0),
        "log_level": float(LOG_LEVELS.get(str(env.get("LOG_LEVEL", "info")).lower(), 1)),
        "liveness_delay_s": float(cfg.get("probes", {}).get("liveness", {}).get("initialDelaySeconds", 0)),
        "image_version": float(parts[0] * 1000 + parts[1] * 100 + min(parts[2], 99)),
    }


def diff_configs(current: dict[str, Any], baseline: dict[str, Any], prefix: str = "") -> list[dict[str, Any]]:
    """Recursive diff -> [{path, expected, actual}]. expected = baseline, actual = current."""
    out: list[dict[str, Any]] = []
    keys = set(current) | set(baseline)
    for k in sorted(keys):
        path = f"{prefix}{k}"
        cv, bv = current.get(k), baseline.get(k)
        if isinstance(cv, dict) and isinstance(bv, dict):
            out.extend(diff_configs(cv, bv, prefix=f"{path}."))
        elif cv != bv:
            out.append({
                "path": path,
                "expected": bv if k in baseline else "<missing>",
                "actual": cv if k in current else "<missing>",
            })
    return out


def detect_drift(workloads: list[dict[str, Any]], baseline: dict[str, Any]) -> list[dict[str, Any]]:
    results = []
    for wl in workloads:
        name = wl["name"]
        b = baseline.get(name, {})
        diffs = diff_configs(wl["config"], b)
        results.append({
            "workload": name,
            "namespace": wl["namespace"],
            "fingerprint": wl["fingerprint"],
            "baselineFingerprint": wl["baselineFingerprint"],
            "drifted": bool(diffs),
            "diffCount": len(diffs),
            "diffs": diffs,
            "simulated": True,
        })
    return results


def detect_outliers(workloads: list[dict[str, Any]], baseline: dict[str, Any]) -> dict[str, Any]:
    """IsolationForest over workload feature vectors (unsupervised, demo-scale n=5)."""
    names = [w["name"] for w in workloads]
    matrix = np.array([[feature_vector(w["config"]).get(k, 0.0) for k in FEATURE_KEYS] for w in workloads])
    base_matrix = np.array([[feature_vector(baseline.get(n, w["config"])).get(k, 0.0) for k in FEATURE_KEYS]
                            for n, w in zip(names, workloads)])

    n = len(workloads)
    model = IsolationForest(
        n_estimators=100,
        contamination=max(1.0 / n, 0.2),
        random_state=42,
    )
    labels = model.fit_predict(matrix)
    scores = model.score_samples(matrix)

    # distance from own baseline vector (sanity signal shown in UI)
    deltas = np.linalg.norm(matrix - base_matrix, axis=1)

    per_workload = []
    for i, name in enumerate(names):
        per_workload.append({
            "workload": name,
            "isOutlier": bool(labels[i] == -1),
            "anomalyScore": round(float(-scores[i]), 4),
            "baselineDistance": round(float(deltas[i]), 4),
            "features": {k: round(float(matrix[i][j]), 3) for j, k in enumerate(FEATURE_KEYS)},
        })
    per_workload.sort(key=lambda r: -r["anomalyScore"])
    return {
        "method": "sklearn.ensemble.IsolationForest",
        "simulated": True,
        "nSamples": n,
        "results": per_workload,
    }


FEATURE_KEYS = [
    "replicas", "cpu_request_m", "cpu_limit_m", "mem_request_mi", "mem_limit_mi",
    "env_count", "db_pool_size", "log_level", "liveness_delay_s", "image_version",
]
