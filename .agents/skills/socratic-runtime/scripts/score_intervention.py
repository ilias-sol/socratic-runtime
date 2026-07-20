#!/usr/bin/env python3
"""Score a structured decision using conservative host thresholds."""

from __future__ import annotations

import json
import sys

def permitted(decision: dict[str, object]) -> tuple[bool, str]:
    if decision.get("decision") == "remain_silent": return True, "model_abstained"
    if float(decision.get("confidence", 0)) < 0.70: return False, "low_confidence"
    if float(decision.get("alternativeStrategyProbability", 1)) >= 0.65: return False, "plausible_alternative_strategy"
    if float(decision.get("solutionLeakageRisk", 1)) > 0.15: return False, "provider_reported_leakage_risk"
    return True, "candidate_for_local_leakage_filter"

if __name__ == "__main__":
    allowed, reason = permitted(json.load(sys.stdin))
    print(json.dumps({"permitted": allowed, "reason": reason}))
    raise SystemExit(0 if allowed else 1)
