"""
sensitive_detector.py
Detects and masks sensitive information in messages.
No raw sensitive values are ever stored in output.
"""

import re
from typing import Optional

# ──────────────────────────────────────────────────────────────
# Sensitivity patterns: ordered by risk (critical first)
# ──────────────────────────────────────────────────────────────
SENSITIVITY_PATTERNS = [
    {
        "type": "password",
        "risk": "critical",
        "pattern": re.compile(
            r"\bpassword\b.{0,30}?(\S+)|"
            r"\bpwd\b.{0,20}?(\S+)|"
            r"\buse password\b.{0,30}?(\S+)|"
            r"\bsign in.{0,30}?([\w#@!\-]+)",
            re.IGNORECASE,
        ),
        "keyword": re.compile(r"\bpassword\b|\bpwd\b|\bsign in.{0,20}password", re.IGNORECASE),
        "action": "do_not_store",
        "description": "Message contains a plaintext password.",
    },
    {
        "type": "payment_card",
        "risk": "critical",
        "pattern": re.compile(r"\b(\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{2,4})\b"),
        "keyword": re.compile(r"\bcard number\b|\bcredit card\b|\bdebit card\b|\bcard no\b", re.IGNORECASE),
        "action": "do_not_store",
        "description": "Message contains a payment card number.",
    },
    {
        "type": "one_time_password",
        "risk": "high",
        "pattern": re.compile(r"\b(OTP|one[\s\-]?time[\s\-]?password|verification code)\b.{0,30}?(\d{4,8})", re.IGNORECASE),
        "keyword": re.compile(r"\bOTP\b|\bone[\s-]time\b|\bverification code\b", re.IGNORECASE),
        "action": "do_not_store",
        "description": "Message contains a one-time password or OTP.",
    },
    {
        "type": "authentication_token",
        "risk": "high",
        "pattern": re.compile(r"\btok_[A-Za-z0-9_\-]+\b|\btoken\s+is\s+(\S+)", re.IGNORECASE),
        "keyword": re.compile(r"\btoken\b|\btok_", re.IGNORECASE),
        "action": "do_not_send_external",
        "description": "Message contains an authentication or access token.",
    },
    {
        "type": "account_recovery_code",
        "risk": "high",
        "pattern": re.compile(r"\bRC[\s\-]\w{2}[\s\-]\w{2}[\s\-]\d{2}[\s\-]\d{2}\b|\baccount recovery code\b.{0,40}?(\S+)", re.IGNORECASE),
        "keyword": re.compile(r"\brecovery code\b|\bRC[\s\-]\w", re.IGNORECASE),
        "action": "do_not_store",
        "description": "Message contains an account recovery code.",
    },
    {
        "type": "personal_identification",
        "risk": "high",
        "pattern": re.compile(r"\bID[\s\-]\d{4}[\s\-]\w{2}[\s\-]\d{2}\b|\bidentification number\b.{0,20}?(ID[\-\w]+)", re.IGNORECASE),
        "keyword": re.compile(r"\bidentification number\b|\bID[\-\s]\d{4}", re.IGNORECASE),
        "action": "do_not_send_external",
        "description": "Message contains a personal identification number.",
    },
    {
        "type": "private_address",
        "risk": "medium",
        "pattern": re.compile(r"\d+\s+[\w\s]+(?:road|street|avenue|lane|rd|st|ave|ln|drive|dr)\b", re.IGNORECASE),
        "keyword": re.compile(r"\bhome address\b|\bmy address\b|\bi live (at|near|on)\b|\blive near\b", re.IGNORECASE),
        "action": "safe_to_process_locally",
        "description": "Message contains a private address or location.",
    },
    {
        "type": "personal_health_information",
        "risk": "medium",
        "pattern": re.compile(r"\btest result\b|\bdiagnosis\b|\bdeficiency\b|\bmedical\b", re.IGNORECASE),
        "keyword": re.compile(r"\btest result\b|\bvitamin\b.{0,10}deficiency|\bmedical\b", re.IGNORECASE),
        "action": "safe_to_process_locally",
        "description": "Message contains personal health information.",
    },
    {
        "type": "personal_preference",
        "risk": "low",
        "pattern": None,
        "keyword": re.compile(r"\bemergency contact\b|\bpersonal note\b|\bfor my profile\b|\bi am vegetarian\b|\bfavourite language\b|\bi prefer\b", re.IGNORECASE),
        "action": "safe_to_process_locally",
        "description": "Message contains personal preference or profile data.",
    },
]

# ──────────────────────────────────────────────────────────────
# Masking helpers
# ──────────────────────────────────────────────────────────────

def _mask_password(text: str) -> str:
    """Replace password values with *****"""
    text = re.sub(
        r"(password\s+\S+\s+to\s+\S+\s+\S+\s+)\S+",
        lambda m: m.group(0).rsplit(" ", 1)[0] + " *****",
        text,
        flags=re.IGNORECASE,
    )
    # Pattern: "Use password XYZ to ..."
    text = re.sub(
        r"((?:use |use password )|(?:password ))([\w#@!\-\.]+)",
        lambda m: m.group(1) + "*****",
        text,
        flags=re.IGNORECASE,
    )
    return text


def _mask_card(text: str) -> str:
    """Mask card number, keep last 4 digits."""
    def replacer(m):
        digits = re.sub(r"[\s\-]", "", m.group(0))
        return "**** **** **** " + digits[-4:]
    return re.sub(r"\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{2,4}\b", replacer, text)


def _mask_token(text: str) -> str:
    """Keep first 4 chars of token, mask the rest."""
    def replacer(m):
        val = m.group(0)
        return val[:8] + "****"
    return re.sub(r"\btok_[A-Za-z0-9_\-]+\b", replacer, text, flags=re.IGNORECASE)


def _mask_recovery_code(text: str) -> str:
    return re.sub(r"\bRC[\s\-]\w{2}[\s\-]\w{2}[\s\-]\d{2}[\s\-]\d{2}\b", "RC-**-**-**-**", text, flags=re.IGNORECASE)


def _mask_id(text: str) -> str:
    return re.sub(r"\bID[\s\-]\d{4}[\s\-]\w{2}[\s\-]\d{2}\b", "ID-****-**-**", text, flags=re.IGNORECASE)


def _mask_address(text: str) -> str:
    return re.sub(
        r"\d+\s+[\w\s]+(?:road|street|avenue|lane|rd|st|ave|ln|drive|dr)\b[,\s]*[\w\-]+[\s\-]\d+",
        "[ADDRESS MASKED]",
        text,
        flags=re.IGNORECASE,
    )


def _mask_health(text: str) -> str:
    # Mask numeric suffix that may be record ID appended to health message
    return re.sub(r"(deficiency|result|diagnosis)[\-\s]*\d+", r"\1-****", text, flags=re.IGNORECASE)


def _mask_otp(text: str) -> str:
    return re.sub(r"\b\d{4,8}\b", "******", text)


def apply_masking(text: str, sensitivity_type: str) -> str:
    """Apply the correct masking function based on type."""
    if sensitivity_type == "password":
        return _mask_password(text)
    elif sensitivity_type == "payment_card":
        return _mask_card(text)
    elif sensitivity_type == "one_time_password":
        return _mask_otp(text)
    elif sensitivity_type == "authentication_token":
        return _mask_token(text)
    elif sensitivity_type == "account_recovery_code":
        return _mask_recovery_code(text)
    elif sensitivity_type == "personal_identification":
        return _mask_id(text)
    elif sensitivity_type == "private_address":
        return _mask_address(text)
    elif sensitivity_type == "personal_health_information":
        return _mask_health(text)
    return text  # no masking for low-risk personal preferences


# ──────────────────────────────────────────────────────────────
# Main detector
# ──────────────────────────────────────────────────────────────

def detect_sensitive(message_id: str, text: str) -> Optional[dict]:
    """
    Detect the highest-risk sensitivity in a message.
    Returns a detection dict or None if not sensitive.
    """
    for pattern_info in SENSITIVITY_PATTERNS:
        keyword_match = pattern_info["keyword"].search(text)
        pattern_match = (
            pattern_info["pattern"].search(text)
            if pattern_info["pattern"] is not None
            else None
        )

        triggered = keyword_match is not None or pattern_match is not None

        if triggered:
            masked = apply_masking(text, pattern_info["type"])
            return {
                "message_id": message_id,
                "sensitivity_type": pattern_info["type"],
                "risk": pattern_info["risk"],
                "masked_text": masked,
                "recommended_action": pattern_info["action"],
                "description": pattern_info["description"],
            }

    return None


def is_sensitive(text: str) -> bool:
    """Quick check: is this message sensitive?"""
    for pattern_info in SENSITIVITY_PATTERNS:
        if pattern_info["keyword"].search(text):
            return True
        if pattern_info["pattern"] and pattern_info["pattern"].search(text):
            return True
    return False
