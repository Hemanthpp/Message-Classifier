"""
main.py
FastAPI backend — serves pre-computed JSON results.
Raw message text is never returned; sensitive values are always masked.
"""

import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# ──────────────────────────────────────────────────────────────
# Load pre-computed data at startup
# ──────────────────────────────────────────────────────────────

BASE = Path(__file__).parent / "output"

MANDATORY_IDS = [
    "MSG_0001","MSG_0002","MSG_0003","MSG_0004","MSG_0005",
    "MSG_0006","MSG_0007","MSG_0009","MSG_0012","MSG_0013",
    "MSG_0014","MSG_0015","MSG_0016","MSG_0024","MSG_0037",
]


def _load(filename: str) -> list:
    p = BASE / filename
    if not p.exists():
        return []
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


classifications: list  = []
tasks_events: list     = []
sensitive: list        = []
stats: dict            = {}


def startup():
    global classifications, tasks_events, sensitive, stats
    classifications = _load("classifications.json")
    tasks_events    = _load("tasks_events.json")
    sensitive       = _load("sensitive_detections.json")

    stats_path = BASE / "stats.json"
    if stats_path.exists():
        with open(stats_path, "r", encoding="utf-8") as f:
            stats = json.load(f)


startup()

# ──────────────────────────────────────────────────────────────
# Build lookup dicts
# ──────────────────────────────────────────────────────────────

cls_map  = {c["message_id"]: c for c in classifications}
sens_map = {s["message_id"]: s for s in sensitive}

# ──────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Message Intelligence API",
    description="Classifies messages, extracts tasks/events, detects sensitive info.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "message": "Message Intelligence API is running."}


@app.get("/api/stats")
def get_stats():
    return stats or {"error": "Stats not computed yet. Run pipeline.py first."}


@app.get("/api/classifications")
def get_classifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category: Optional[str] = None,
    q: Optional[str] = None,
):
    data = classifications

    if category:
        data = [c for c in data if c["category"] == category]

    if q:
        q_lower = q.lower()
        data = [c for c in data if q_lower in c["message_id"].lower() or q_lower in c["reason"].lower()]

    total = len(data)
    start = (page - 1) * page_size
    end   = start + page_size
    page_data = data[start:end]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": page_data,
    }


@app.get("/api/classifications/{message_id}")
def get_classification(message_id: str):
    if message_id not in cls_map:
        raise HTTPException(status_code=404, detail=f"Message {message_id} not found.")
    result = dict(cls_map[message_id])
    # Attach sensitive info if present
    if message_id in sens_map:
        result["sensitive"] = sens_map[message_id]
    # Attach extracted tasks/events if present
    result["tasks_events"] = [t for t in tasks_events if t["source_message_id"] == message_id]
    return result


@app.get("/api/tasks")
def get_tasks(
    type: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    data = tasks_events
    if type:
        data = [t for t in data if t["type"] == type]
    if priority:
        data = [t for t in data if t["priority"] == priority]

    total = len(data)
    start = (page - 1) * page_size
    page_data = data[start : start + page_size]

    return {"total": total, "page": page, "page_size": page_size, "data": page_data}


@app.get("/api/sensitive")
def get_sensitive(
    risk: Optional[str] = None,
    sensitivity_type: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    data = sensitive
    if risk:
        data = [s for s in data if s["risk"] == risk]
    if sensitivity_type:
        data = [s for s in data if s["sensitivity_type"] == sensitivity_type]

    total = len(data)
    start = (page - 1) * page_size
    page_data = data[start : start + page_size]

    return {"total": total, "page": page, "page_size": page_size, "data": page_data}


@app.get("/api/mandatory")
def get_mandatory():
    """Return classification, task/event, and sensitive data for the 15 mandatory IDs."""
    results = []
    for mid in MANDATORY_IDS:
        entry = {
            "message_id": mid,
            "classification": cls_map.get(mid),
            "sensitive": sens_map.get(mid),
            "tasks_events": [t for t in tasks_events if t["source_message_id"] == mid],
        }
        results.append(entry)
    return {"mandatory_ids": MANDATORY_IDS, "data": results}


@app.get("/api/search")
def search(
    q: str = Query(..., min_length=1),
    category: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    q_lower = q.lower()
    data = [
        c for c in classifications
        if q_lower in c["message_id"].lower()
        or q_lower in c["reason"].lower()
        or q_lower in c["category"].lower()
    ]
    if category:
        data = [c for c in data if c["category"] == category]

    total = len(data)
    start = (page - 1) * page_size
    page_data = data[start : start + page_size]
    return {"total": total, "page": page, "page_size": page_size, "data": page_data}
