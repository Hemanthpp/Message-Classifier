"""
pipeline.py
Full processing pipeline: reads messages.csv, classifies every message,
extracts tasks/events, detects sensitive info, writes output JSON files.

Usage:
    python pipeline.py --input path/to/messages.csv
"""

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

# Ensure backend/ is in path when run from project root
sys.path.insert(0, str(Path(__file__).parent))

from classifier import classify_message, train_tfidf_on_dataset, CAT_ACTION, CAT_MEETING
from extractor import extract_item, reset_counter
from sensitive_detector import detect_sensitive

OUTPUT_DIR = Path(__file__).parent / "output"


def load_messages(csv_path: str) -> list:
    """Load messages from CSV, returning list of dicts."""
    messages = []
    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            messages.append({
                "message_id": row["message_id"].strip(),
                "timestamp":  row["timestamp"].strip(),
                "sender":     row["sender"].strip(),
                "message":    row["message"].strip(),
            })
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(f"  Loaded {len(messages)} messages.")
    return messages


def stage1_classify(messages: list) -> list:
    """
    Stage 1: Rule-based classification of all messages.
    Also attaches a _rule_label for TF-IDF training.
    """
    results = []
    for msg in messages:
        result = classify_message(
            msg["message_id"],
            msg["sender"],
            msg["message"],
        )
        # Keep _rule_label for TF-IDF training
        msg["_rule_label"] = result["category"]
        results.append(result)
    return results


def stage2_train_and_reclassify(messages: list, classifications: list) -> list:
    """
    Stage 2: Train TF-IDF model on rule-labeled data,
    then reclassify low-confidence messages.
    """
    print("  Training TF-IDF model on rule-labeled data…")
    train_tfidf_on_dataset(messages)

    updated = 0
    for i, msg in enumerate(messages):
        if classifications[i]["confidence"] < 0.80:
            new_result = classify_message(msg["message_id"], msg["sender"], msg["message"])
            if new_result["confidence"] > classifications[i]["confidence"]:
                classifications[i] = new_result
                updated += 1
    print(f"  TF-IDF updated {updated} low-confidence classifications.")
    return classifications


def stage3_extract(messages: list, classifications: list) -> list:
    """Extract tasks and events from action_required and meeting_or_event messages."""
    reset_counter()
    cat_map = {c["message_id"]: c["category"] for c in classifications}
    items = []
    for msg in messages:
        cat = cat_map.get(msg["message_id"], "")
        if cat in (CAT_ACTION, CAT_MEETING):
            item = extract_item(
                msg["message_id"],
                msg["sender"],
                msg["message"],
                cat,
            )
            if item is not None:
                items.append(item)
    return items


def stage4_detect_sensitive(messages: list) -> list:
    """Detect and mask sensitive information in all messages."""
    detections = []
    for msg in messages:
        result = detect_sensitive(msg["message_id"], msg["message"])
        if result is not None:
            detections.append(result)
    return detections


def compute_stats(classifications: list, tasks_events: list, sensitive: list) -> dict:
    """Compute dashboard statistics."""
    from collections import Counter
    cat_counts = Counter(c["category"] for c in classifications)
    type_counts = Counter(t["type"] for t in tasks_events)
    risk_counts = Counter(s["risk"] for s in sensitive)

    avg_confidence = sum(c["confidence"] for c in classifications) / len(classifications) if classifications else 0

    return {
        "total_messages": len(classifications),
        "total_tasks_events": len(tasks_events),
        "total_sensitive": len(sensitive),
        "avg_confidence": round(avg_confidence, 4),
        "categories": dict(cat_counts),
        "task_event_types": dict(type_counts),
        "sensitivity_risks": dict(risk_counts),
    }


def run_pipeline(csv_path: str):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("\n=== Message Intelligence Pipeline ===\n")

    # Load
    print("[1/5] Loading messages…")
    messages = load_messages(csv_path)

    # Classify (rule-based)
    print("[2/5] Classifying messages (rule-based)…")
    t0 = time.time()
    classifications = stage1_classify(messages)
    print(f"  Done in {time.time() - t0:.2f}s")

    # Classify (TF-IDF refinement)
    print("[3/5] Refining with TF-IDF model…")
    t0 = time.time()
    classifications = stage2_train_and_reclassify(messages, classifications)
    print(f"  Done in {time.time() - t0:.2f}s")

    # Extract tasks/events
    print("[4/5] Extracting tasks and events…")
    t0 = time.time()
    tasks_events = stage3_extract(messages, classifications)
    print(f"  Extracted {len(tasks_events)} items in {time.time() - t0:.2f}s")

    # Detect sensitive
    print("[5/5] Detecting sensitive information…")
    t0 = time.time()
    sensitive = stage4_detect_sensitive(messages)
    print(f"  Detected {len(sensitive)} sensitive messages in {time.time() - t0:.2f}s")

    # Compute stats
    stats = compute_stats(classifications, tasks_events, sensitive)

    # Write outputs
    out_cls  = OUTPUT_DIR / "classifications.json"
    out_te   = OUTPUT_DIR / "tasks_events.json"
    out_sens = OUTPUT_DIR / "sensitive_detections.json"
    out_stats = OUTPUT_DIR / "stats.json"

    with open(out_cls,  "w", encoding="utf-8") as f:
        json.dump(classifications, f, indent=2, ensure_ascii=False)

    with open(out_te,   "w", encoding="utf-8") as f:
        json.dump(tasks_events, f, indent=2, ensure_ascii=False)

    with open(out_sens, "w", encoding="utf-8") as f:
        json.dump(sensitive, f, indent=2, ensure_ascii=False)

    with open(out_stats, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    print("\n[DONE] Pipeline complete!")
    print(f"   Classifications : {out_cls}")
    print(f"   Tasks & Events  : {out_te}")
    print(f"   Sensitive       : {out_sens}")
    print(f"   Stats           : {out_stats}")
    print("\nSummary:")
    print(f"  Total messages classified : {stats['total_messages']}")
    print(f"  Tasks & events extracted  : {stats['total_tasks_events']}")
    print(f"  Sensitive messages found  : {stats['total_sensitive']}")
    print(f"  Average confidence        : {stats['avg_confidence']:.2%}")
    print("\nCategory breakdown:")
    for cat, count in sorted(stats["categories"].items(), key=lambda x: -x[1]):
        print(f"  {cat:<30} {count:>4}")

    # Verify mandatory IDs
    mandatory_ids = [
        "MSG_0001","MSG_0002","MSG_0003","MSG_0004","MSG_0005",
        "MSG_0006","MSG_0007","MSG_0009","MSG_0012","MSG_0013",
        "MSG_0014","MSG_0015","MSG_0016","MSG_0024","MSG_0037",
    ]
    cls_ids = {c["message_id"] for c in classifications}
    missing = [mid for mid in mandatory_ids if mid not in cls_ids]
    if missing:
        print(f"\n[WARNING] Mandatory IDs missing from output: {missing}")
    else:
        print("\n[OK] All 15 mandatory IDs present in output.")

    return classifications, tasks_events, sensitive, stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Message Intelligence Pipeline")
    parser.add_argument(
        "--input",
        default=r"C:\Users\Hemanth P P\Downloads\L1_Candidate_Dataset\messages.csv",
        help="Path to messages.csv",
    )
    args = parser.parse_args()
    run_pipeline(args.input)
