# Message Intelligence System

> AI/ML Intern Assignment — Message Classification, Task Extraction & Sensitive Information Detection

**Live Demo:** `https://message-classifier-nine.vercel.app/`  
**API / Backend:** `https://message-classifier-gg9w.onrender.com`  
**Video Walkthrough:** `[Link to your Loom Video]`

---

## Overview

A full-stack intelligent message processing system that classifies 900 fictional messages, extracts tasks and events, and detects sensitive information — all processed **locally** without sending raw data to external AI services.

---

## System Architecture

```
messages.csv (900 rows)
     │
     ▼
pipeline.py
     ├── classifier.py        → classifications.json
     ├── extractor.py         → tasks_events.json
     └── sensitive_detector.py → sensitive_detections.json
     │
     ▼
main.py (FastAPI)    ←→    React + Vite (frontend/)
```

---

## Part 1: Message Classification

### How It Works

A **two-stage hybrid classifier** is used:

**Stage 1 — Rule-Based (Primary)**  
Regex patterns are evaluated in priority order:

| Priority | Category | Signal |
|----------|----------|--------|
| 1 | `sensitive_information` | `password`, `card number`, `token`, `recovery code`, `ID-\d{4}` |
| 2 | `promotional` | Promotional sender name OR `use code SAVE`, `flash sale`, `% off` |
| 3 | `meeting_or_event` | `calendar update`, `scheduled for`, `please join`, `happens on` |
| 4 | `action_required` | `deadline is`, `due on`, `please review/submit/complete` |
| 5 | `personal_information` | `for my profile`, `home address`, `emergency contact`, `test result` |
| 6 | `general_information` | Fallback — no other pattern matched |

**Stage 2 — TF-IDF + Logistic Regression (Fallback)**  
After rule-labeling all messages, a TF-IDF vectorizer (bigrams, 5000 features) + Logistic Regression model is trained on the rule-labeled data. Messages with confidence < 0.80 are re-evaluated with the ML model. The higher-confidence result wins.

### Output Format

```json
{
  "message_id": "MSG_0001",
  "category": "meeting_or_event",
  "confidence": 0.93,
  "reason": "Message describes a scheduled meeting, event, or reminder (calendar update)."
}
```

### Categories

| Category | Description |
|----------|-------------|
| `action_required` | Requires the reader to take an action or has a deadline |
| `meeting_or_event` | Describes a scheduled meeting, calendar event, or reminder |
| `personal_information` | Reveals personal preferences, health info, or profile data |
| `general_information` | Informational — no action, event, or sensitive content |
| `promotional` | Advertising, discounts, or subscription offers |
| `sensitive_information` | Contains passwords, card numbers, tokens, or IDs |

---

## Part 2: Task and Event Extraction

### How It Works

Extraction runs on messages classified as `action_required` or `meeting_or_event`.

1. **Type detection** — event triggers (`calendar update`, `scheduled for`, `please join`) vs. task triggers (`deadline is`, `due on`, `please review`)
2. **Date extraction** — ISO date regex (`\d{4}-\d{2}-\d{2}`), parsed with `python-dateutil`
3. **Time extraction** — `HH:MM` or `H AM/PM` regex
4. **Location extraction** — Named location patterns (`Conference Room`, `Zoom`, `Google Meet`, etc.)
5. **Priority** — `urgent/important/ASAP` → high; deadline present → medium; else → low
6. **Unresolved detection** — Vague words (`Friday`, `tomorrow`, `afternoon`) without a concrete date → stored as `"unresolved"`, never guessed

### Output Format

```json
{
  "item_id": "EVT_001",
  "type": "event",
  "title": "Calendar update: family dinner",
  "description": "For today: Calendar update: family dinner, 2026-09-19 at 10:00, the library.",
  "date": "2026-09-19",
  "time": "10:00",
  "location": "the library",
  "person": "Meera",
  "priority": "medium",
  "source_message_id": "MSG_0001"
}
```

---

## Part 3: Sensitive Information Detection

### How It Works

A priority-ordered list of regex patterns scans every message:

| Type | Detection Signal | Risk | Recommended Action |
|------|-----------------|------|--------------------|
| `password` | `password`, `use password`, keyword near credential | critical | do_not_store |
| `payment_card` | 4-4-4-4 digit pattern | critical | do_not_store |
| `one_time_password` | `OTP`, `one-time password`, `verification code` | high | do_not_store |
| `authentication_token` | `tok_` prefix, `token is` | high | do_not_send_external |
| `account_recovery_code` | `RC-XX-XX-XX-XX` pattern | high | do_not_store |
| `personal_identification` | `ID-NNNN-XX-NN` pattern | high | do_not_send_external |
| `private_address` | Street address regex, `home address` | medium | safe_to_process_locally |
| `personal_health_information` | `test result`, `deficiency` | medium | safe_to_process_locally |
| `personal_preference` | `for my profile`, `emergency contact` | low | safe_to_process_locally |

### Masking Rules

| Type | Masking Strategy |
|------|-----------------|
| Passwords | Replace credential value with `*****` |
| Card numbers | `**** **** **** XXXX` (last 4 kept) |
| Tokens | First 8 chars kept + `****` |
| Recovery codes | `RC-**-**-**-**` |
| ID numbers | `ID-****-**-**` |
| Addresses | `[ADDRESS MASKED]` |
| Health info | Numeric suffix masked with `-****` |

### Output Format

```json
{
  "message_id": "MSG_0013",
  "sensitivity_type": "payment_card",
  "risk": "critical",
  "masked_text": "One more thing: My card number is **** **** **** 1111-92.",
  "recommended_action": "do_not_store",
  "description": "Message contains a payment card number."
}
```

---

## Assumptions and Limitations

### Assumptions
- Messages are processed in chronological order (as supplied)
- The `sender` field provides reliable context (e.g., "Promotions" → promotional)
- Confidence scores represent rule-match certainty, not probability calibration
- The TF-IDF model is trained on rule-labeled data (self-supervised) — no ground-truth labels exist
- Personal preference data (diet, language preference) is classified as `personal_information`, not `sensitive_information`, unless accompanied by a credential

### Limitations
- The rule-based classifier may misclassify messages with complex mixed signals (e.g., a promotional message that also contains a deadline)
- TF-IDF fallback cannot resolve genuine ambiguity — it reflects the pattern of the training data
- Date extraction only handles ISO format dates (`YYYY-MM-DD`); natural language dates like "next Monday" are marked `unresolved`
- Token masking keeps the first 8 chars — sufficiently long tokens may still leak partial info
- The system processes English-language messages only

---

## AI Tool Usage Declaration

> In accordance with the assignment guidelines, I am disclosing the use of an AI coding assistant (Google Gemini) during the development of this project. 
> 
> **My Contribution & Understanding:**
> The AI was used primarily for code scaffolding, React component styling, and boilerplate generation. All core logic—including the regex matching patterns, the two-stage classification architecture (Rule-based + TF-IDF Logistic Regression), and the privacy masking rules—was explicitly directed, reviewed, and deeply understood by me. I am fully prepared to explain and defend every line of the backend logic, data flow, and frontend architecture.
> 
> **Authenticity of Results:**
> Zero outputs or results have been fabricated. The classification and extraction metrics shown in the dashboard are dynamically generated by running the `pipeline.py` script locally on the provided dataset. No raw data was sent to any external AI API for processing.

---

## Running Locally

### 1. Install Python (3.10+)

### 2. Install backend dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Run the pipeline

```bash
python pipeline.py --input "C:\path\to\messages.csv"
```

This generates `backend/output/classifications.json`, `tasks_events.json`, `sensitive_detections.json`, and `stats.json`.

### 4. Start the API server

```bash
uvicorn main:app --reload --port 8000
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Project Structure

```
Kastack/
├── backend/
│   ├── classifier.py          # Rule-based + TF-IDF classifier
│   ├── extractor.py           # Task & event extractor
│   ├── sensitive_detector.py  # Sensitive info detector & masker
│   ├── pipeline.py            # Full processing pipeline
│   ├── main.py                # FastAPI REST API
│   ├── requirements.txt
│   └── output/                # Generated JSON output files
│       ├── classifications.json
│       ├── tasks_events.json
│       ├── sensitive_detections.json
│       └── stats.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api.js
    │   ├── utils.js
    │   ├── index.css
    │   └── components/
    │       ├── Dashboard.jsx
    │       ├── ClassificationView.jsx
    │       ├── TasksEventsView.jsx
    │       ├── SensitiveView.jsx
    │       └── MandatoryPanel.jsx
    ├── index.html
    └── vite.config.js
```

---

## Dataset Note

The original `messages.csv` dataset is **not included** in this repository, as required by the assignment rules. It must be obtained from the assignment email.
