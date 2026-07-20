# Limitations

- Live assessment requires an installed and authenticated Codex CLI, network access, and model entitlement.
- Python and pytest are the fully exercised demonstration. Other languages require a tested target shape and verifier integration.
- Symbol discovery covers common declaration shapes, not every language grammar or generated source format.
- Generic verification-count parsing is best-effort; process exit status remains authoritative. Verifiers should emit explicit no-tests evidence if an empty test run must be rejected.
- Automatic snapshot checks cover the configured target only. Arbitrary terminal commands are outside the runtime.
- The model can misclassify observable behavior. Conservative thresholds and fail-safe silence reduce but do not remove this risk.
- Progressive follow-ups are capped at three support steps per episode; the final UI directs a still-stuck learner toward an instructor rather than generating solution code.
- The verifier harness must consume `${snapshot}` or `SOCRATIC_SNAPSHOT`.
- Packaged Windows behavior is tested; macOS and Linux packages are unverified.
- The product estimates productive struggle from code and verification history. It cannot read cognition or guarantee learning.
