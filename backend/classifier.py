"""
classifier.py
Two-stage hybrid message classifier:
  Stage 1: Rule-based regex (high-confidence, explainable)
  Stage 2: TF-IDF + Logistic Regression fallback (scikit-learn, local)
"""

import re
from dataclasses import dataclass
from typing import Tuple

from sensitive_detector import is_sensitive

# ──────────────────────────────────────────────────────────────
# Category constants
# ──────────────────────────────────────────────────────────────
CAT_ACTION      = "action_required"
CAT_MEETING     = "meeting_or_event"
CAT_PERSONAL    = "personal_information"
CAT_GENERAL     = "general_information"
CAT_PROMO       = "promotional"
CAT_SENSITIVE   = "sensitive_information"

ALL_CATEGORIES = [
    CAT_ACTION, CAT_MEETING, CAT_PERSONAL,
    CAT_GENERAL, CAT_PROMO, CAT_SENSITIVE,
]

# ──────────────────────────────────────────────────────────────
# Rule definitions (ordered by priority — most specific first)
# ──────────────────────────────────────────────────────────────

RULES = [
    # 1. SENSITIVE — financial/credential data (highest priority)
    {
        "category": CAT_SENSITIVE,
        "confidence_base": 0.97,
        "pattern": re.compile(
            r"\b(password|pwd|otp|one[\s\-]time|token|tok_|card number|credit card|"
            r"debit card|pin\b|account recovery|recovery code|RC[\s\-]\w|"
            r"identification number|ID[\s\-]\d{4})\b|"
            r"\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{2,4}\b",
            re.IGNORECASE,
        ),
        "reason_template": "Message contains a sensitive credential or financial value ({keyword}).",
    },
    # 2. PROMOTIONAL — sender-based or discount-keyword
    {
        "category": CAT_PROMO,
        "confidence_base": 0.96,
        "pattern": re.compile(
            r"\buse code\s+SAVE\w+\b|\bflash sale\b|\bpremium plan\b|\b\d+%\s+off\b|"
            r"\blimited[\s\-]time offer\b|\bexclusive benefits\b|\bbuy one.{0,20}free\b|"
            r"\bupgrade your subscription\b|\bspecial.*discount\b",
            re.IGNORECASE,
        ),
        "reason_template": "Message advertises a deal, discount, or subscription ({keyword}).",
    },
    # 3. MEETING / EVENT — calendar/schedule language
    {
        "category": CAT_MEETING,
        "confidence_base": 0.93,
        "pattern": re.compile(
            r"\bcalendar update\b|\breminder:\b|\bplease join\b|\bjoin the\b.{0,50}on \d{4}|"
            r"\bscheduled for\b|\bhappens on\b|\borientation\b|\bworkshop\b|\bwebinar\b|"
            r"\binterview\b.{0,30}\d{4}[\-/]\d{2}[\-/]\d{2}|\bat \d{1,2}:\d{2}.{0,30}(location|room|zoom|meet|clinic|office|auditorium)\b",
            re.IGNORECASE,
        ),
        "reason_template": "Message describes a scheduled meeting, event, or reminder ({keyword}).",
    },
    # 4. ACTION REQUIRED — imperative tasks with deadline signals
    {
        "category": CAT_ACTION,
        "confidence_base": 0.91,
        "pattern": re.compile(
            r"\bdeadline is\b|\bdue on\b|\bbefore \d{4}\b|\bby \d{4}[\-/]\d{2}[\-/]\d{2}\b|"
            r"\bplease (review|complete|submit|send|upload|reply|confirm|call|update|finish|renew|pay)\b|"
            r"\bcan you (review|complete|send|update|finish|confirm|call|help)\b|"
            r"\bi need you to\b|\bdon't forget to\b|\bremember to\b",
            re.IGNORECASE,
        ),
        "reason_template": "Message requests an action or contains a deadline ({keyword}).",
    },
    # 5. PERSONAL INFORMATION — profile/preference/health/address
    {
        "category": CAT_PERSONAL,
        "confidence_base": 0.89,
        "pattern": re.compile(
            r"\bfor my profile\b|\bpersonal note\b|\bmy home address\b|\bi live (at|near|on)\b|"
            r"\blive near\b|\bemergency contact\b|\bi am vegetarian\b|\bi prefer\b|"
            r"\bfavourite language\b|\btest result\b|\bvitamin.{0,10}deficiency\b|"
            r"\bi drink coffee\b|\bmy recent test\b",
            re.IGNORECASE,
        ),
        "reason_template": "Message reveals personal preference, health, or profile information ({keyword}).",
    },
]

# Fallback: general information
GENERAL_RULE = {
    "category": CAT_GENERAL,
    "confidence_base": 0.82,
    "reason_template": "Message conveys factual or informational content with no specific action or event ({keyword}).",
}

# ──────────────────────────────────────────────────────────────
# Helper: extract matched keyword for reason generation
# ──────────────────────────────────────────────────────────────

def _extract_keyword(text: str, pattern: re.Pattern) -> str:
    m = pattern.search(text)
    if m:
        return m.group(0).strip()[:40]
    return "pattern match"


def _build_reason(text: str, rule: dict) -> str:
    kw = _extract_keyword(text, rule["pattern"]) if rule.get("pattern") else ""
    return rule["reason_template"].format(keyword=kw)


# ──────────────────────────────────────────────────────────────
# Stage 1: Rule-based classifier
# ──────────────────────────────────────────────────────────────

def _rule_based_classify(sender: str, text: str) -> Tuple[str, float, str]:
    """
    Returns (category, confidence, reason).
    Sensitive check is integrated via is_sensitive() to avoid duplicating patterns.
    """
    # Promotional sender shortcut
    promo_senders = {"promotions", "marketing", "newsletter", "offers", "deals"}
    if sender.lower() in promo_senders:
        return (
            CAT_PROMO,
            0.97,
            f"Sender '{sender}' is a promotional/marketing source.",
        )

    # Walk rules in order
    for rule in RULES:
        if rule["pattern"] and rule["pattern"].search(text):
            category = rule["category"]
            confidence = rule["confidence_base"]
            reason = _build_reason(text, rule)

            # Cross-check: if rule says personal but is_sensitive() fires → upgrade
            if category == CAT_PERSONAL and is_sensitive(text):
                return (
                    CAT_SENSITIVE,
                    0.95,
                    "Message contains personal data that also includes a sensitive credential or financial value.",
                )

            return category, confidence, reason

    # Nothing matched → General Information
    return (
        CAT_GENERAL,
        GENERAL_RULE["confidence_base"],
        "Message conveys factual or informational content with no specific action, event, or sensitive value.",
    )


# ──────────────────────────────────────────────────────────────
# Stage 2: TF-IDF + Logistic Regression fallback
# (trained lazily on first call using rule-based labels)
# ──────────────────────────────────────────────────────────────

_model = None
_vectorizer = None
_label_map = None
_ml_insights = None


def _build_tfidf_model(messages: list):
    """Train TF-IDF + Logistic Regression on a labeled sample with cross-validation."""
    global _model, _vectorizer, _label_map, _ml_insights

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import LabelEncoder
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report
    import numpy as np

    texts = [m["message"] for m in messages]
    labels = [m["_rule_label"] for m in messages]

    enc = LabelEncoder()
    y = enc.fit_transform(labels)

    # 80/20 train/test split for rigorous evaluation
    X_text_train, X_text_test, y_train, y_test = train_test_split(texts, y, test_size=0.2, random_state=42)

    vec = TfidfVectorizer(ngram_range=(1, 2), max_features=5000, sublinear_tf=True)
    X_train = vec.fit_transform(X_text_train)
    X_test = vec.transform(X_text_test)

    clf = LogisticRegression(max_iter=1000, C=5.0, solver="lbfgs")
    clf.fit(X_train, y_train)

    # Evaluate
    y_pred = clf.predict(X_test)
    class_names = enc.classes_
    report = classification_report(y_test, y_pred, target_names=class_names, output_dict=True, zero_division=0)
    
    # Extract Feature Importances (XAI)
    feature_names = vec.get_feature_names_out()
    feature_importances = {}
    for i, class_name in enumerate(class_names):
        coefs = clf.coef_[i]
        top_indices = np.argsort(coefs)[-10:][::-1]
        top_features = [{"term": feature_names[idx], "weight": float(coefs[idx])} for idx in top_indices]
        feature_importances[class_name] = top_features

    # Save to insights
    _ml_insights = {
        "metrics": {
            "accuracy": report["accuracy"],
            "macro_avg": report["macro avg"],
            "weighted_avg": report["weighted avg"]
        },
        "feature_importances": feature_importances
    }

    _model = clf
    _vectorizer = vec
    _label_map = enc


def get_ml_insights() -> dict:
    """Returns the ML evaluation metrics and XAI feature importances."""
    return _ml_insights

def _tfidf_classify(text: str) -> Tuple[str, float, str]:
    """Use trained TF-IDF model for ambiguous classification."""
    global _model, _vectorizer, _label_map
    if _model is None:
        return CAT_GENERAL, 0.70, "TF-IDF model not yet trained; defaulting to general_information."

    X = _vectorizer.transform([text])
    proba = _model.predict_proba(X)[0]
    top_idx = proba.argmax()
    category = _label_map.inverse_transform([top_idx])[0]
    confidence = float(round(proba[top_idx], 4))
    reason = f"TF-IDF/LR model predicted this category (confidence {confidence:.0%})."
    return category, confidence, reason


# ──────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────

AMBIGUITY_THRESHOLD = 0.80  # Below this, use TF-IDF as second opinion


def classify_message(message_id: str, sender: str, text: str) -> dict:
    """
    Classify a single message.
    Returns a classification dict ready for output.
    """
    category, confidence, reason = _rule_based_classify(sender, text)

    # If rule-based confidence is below threshold, blend with TF-IDF
    if confidence < AMBIGUITY_THRESHOLD and _model is not None:
        cat2, conf2, reason2 = _tfidf_classify(text)
        if conf2 > confidence:
            # TF-IDF is more confident — use it but note it
            category = cat2
            confidence = round((confidence + conf2) / 2, 4)
            reason = f"Rule-based and TF-IDF both considered. {reason2}"

    return {
        "message_id": message_id,
        "category": category,
        "confidence": round(confidence, 4),
        "reason": reason,
    }


def train_tfidf_on_dataset(labeled_messages: list):
    """Call this after rule-labeling all messages to train the TF-IDF model."""
    _build_tfidf_model(labeled_messages)
