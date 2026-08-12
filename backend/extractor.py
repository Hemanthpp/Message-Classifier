"""
extractor.py
Extracts tasks and events from messages classified as
'action_required' or 'meeting_or_event'.
Never guesses missing fields — uses null / "unresolved" instead.
"""

import re
from typing import Optional
from dateutil import parser as date_parser
from dateutil.parser import ParserError

# ──────────────────────────────────────────────────────────────
# Regex patterns
# ──────────────────────────────────────────────────────────────

# Matches ISO-style dates: 2026-09-01
DATE_RE = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")

# Matches times: 15:00, 9 AM, 6 PM
TIME_RE = re.compile(r"\b(\d{1,2}:\d{2})\b|\b(\d{1,2}\s?(AM|PM))\b", re.IGNORECASE)

# Vague time references that cannot be resolved to a date
VAGUE_DATE_RE = re.compile(
    r"\b(friday|monday|tuesday|wednesday|thursday|saturday|sunday|"
    r"tomorrow|tonight|this week|next week|soon|afternoon|morning|evening)\b",
    re.IGNORECASE,
)

# Location / meeting place
LOCATION_RE = re.compile(
    r"\b(?:at|in)\s+(Conference Room \d+|Meeting Room [A-Z]|Zoom|Google Meet|"
    r"the main office|the college auditorium|the city clinic|the library)\b",
    re.IGNORECASE,
)

# Meeting / event triggers
EVENT_TRIGGERS = re.compile(
    r"\b(calendar update|reminder:|please join|join the|scheduled for|happens on|"
    r"internship orientation|AI workshop|study[\s\-]group|product demo|client discussion|"
    r"project review|sprint planning|mentor catch[\s\-]up|doctor appointment|"
    r"placement briefing|technical interview|family dinner|team stand[\s\-]up|webinar)\b",
    re.IGNORECASE,
)

# Task / deadline triggers
TASK_TRIGGERS = re.compile(
    r"\b(please review|can you review|can you update|please complete|please confirm|"
    r"please call|please reply|please send|please submit|please upload|please finish|"
    r"please renew|please pay|i need you to|don't forget to|deadline is|due on|"
    r"before \d{4}|by \d{4}[\-/]\d{2}|can you finish|can you send)\b",
    re.IGNORECASE,
)

# Priority keywords
HIGH_PRIORITY_RE = re.compile(r"\b(urgent|asap|important|critical|immediately)\b", re.IGNORECASE)
LOW_PRIORITY_RE  = re.compile(r"\b(if possible|when you can|when free|whenever)\b", re.IGNORECASE)

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

_task_counter = [0]


def _next_item_id(prefix: str) -> str:
    _task_counter[0] += 1
    return f"{prefix}_{_task_counter[0]:03d}"


def _extract_date(text: str) -> Optional[str]:
    m = DATE_RE.search(text)
    if m:
        try:
            dt = date_parser.parse(m.group(1))
            return dt.strftime("%Y-%m-%d")
        except ParserError:
            return None
    return None


def _extract_time(text: str) -> Optional[str]:
    m = TIME_RE.search(text)
    if m:
        return m.group(0).strip()
    return None


def _extract_location(text: str) -> Optional[str]:
    m = LOCATION_RE.search(text)
    if m:
        return m.group(1).strip()
    return None


def _is_vague_date(text: str) -> bool:
    return bool(VAGUE_DATE_RE.search(text)) and not DATE_RE.search(text)


def _infer_priority(text: str) -> str:
    if HIGH_PRIORITY_RE.search(text):
        return "high"
    if LOW_PRIORITY_RE.search(text):
        return "low"
    # Deadlines in near future default to medium
    if DATE_RE.search(text):
        return "medium"
    return "low"


def _extract_title(text: str, item_type: str) -> str:
    """
    Try to extract a meaningful title. Falls back to
    the first ~60 chars of the cleaned message.
    """
    # Remove common prefix phrases
    cleaned = re.sub(
        r"^(for today:|one more thing:|just checking—|quick update:|please note:|"
        r"fyi:|hi,|important:|can you help\?|for my profile,)\s*",
        "",
        text.strip(),
        flags=re.IGNORECASE,
    ).strip()

    # Try to grab the core activity from event triggers
    m = EVENT_TRIGGERS.search(cleaned)
    if m:
        # Extract the phrase around the trigger
        start = max(0, m.start() - 5)
        snippet = cleaned[start : m.end() + 40].strip()
        # Truncate at comma or period
        snippet = re.split(r"[,.]", snippet)[0].strip()
        return snippet[:80]

    # For tasks, extract the action verb phrase
    m = TASK_TRIGGERS.search(cleaned)
    if m:
        snippet = cleaned[m.start() :].strip()
        snippet = re.split(r"[;,\.]", snippet)[0].strip()
        return snippet[:80]

    # Fallback: first 60 chars
    return cleaned[:60].strip()


# ──────────────────────────────────────────────────────────────
# Main extractor
# ──────────────────────────────────────────────────────────────

def extract_item(message_id: str, sender: str, text: str, category: str) -> Optional[dict]:
    """
    Extract a task or event from a classified message.
    Returns None if nothing actionable can be extracted.
    """
    is_event = EVENT_TRIGGERS.search(text) is not None
    is_task  = TASK_TRIGGERS.search(text)  is not None

    # Nothing to extract
    if not is_event and not is_task:
        return None

    item_type = "event" if is_event else "task"
    # If both triggers fire, prefer event (has richer structure)
    if is_event and is_task:
        item_type = "event"

    item_id = _next_item_id("EVT" if item_type == "event" else "TASK")
    title = _extract_title(text, item_type)

    # Date extraction
    date_val = _extract_date(text)
    date_str: Optional[str]
    if date_val:
        date_str = date_val
    elif _is_vague_date(text):
        date_str = "unresolved"
    else:
        date_str = None

    # Deadline vs date
    deadline = None
    event_date = None
    if item_type == "task":
        deadline = date_str
    else:
        event_date = date_str

    time_val  = _extract_time(text)
    location  = _extract_location(text) if item_type == "event" else None
    priority  = _infer_priority(text)

    # Person: use the sender as the person involved
    person = sender if sender.lower() not in {"promotions", "hr team", "project lead"} else None

    result = {
        "item_id":           item_id,
        "type":              item_type,
        "title":             title,
        "description":       text,
        "person":            person,
        "priority":          priority,
        "source_message_id": message_id,
    }

    if item_type == "task":
        result["deadline"] = deadline
        result["time"]     = time_val
    else:
        result["date"]     = event_date
        result["time"]     = time_val
        result["location"] = location

    return result


def reset_counter():
    """Reset the item ID counter (for testing)."""
    _task_counter[0] = 0
