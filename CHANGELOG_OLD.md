# Older changes
## 0.1.0 (2026-06-23)
* (meistermopper) Initial stable beta release
* (meistermopper) Re-introduced `remoteControl` state with dynamic multi-endpoint API polling logic
* (meistermopper) Optimized polling rate limits and connection state management
* (meistermopper) Configured automated changelog rotation to keep READMEs clean
* (meistermopper) Refactored codebase using the latest adapter creator standards

## 0.0.29 (2026-06-23)
* (meistermopper) Re-introduced `remoteControl` state with reliable combined multi-endpoint API logic (latest-data & devices/state)
* (meistermopper) Fix online status to use connectionState.connected from device state

## 0.0.28 (2026-06-21)
* (meistermopper) Re-introduced `remoteReady` state with self-correction logic

## 0.0.27 (2026-06-18)
* (meistermopper) Corrected adapter category to 'climate-control' for repository compliance

## 0.0.26 (2026-06-17)
* (meistermopper) Preparing 0.0.26 release

## 0.0.25 (2026-06-16)
* (meistermopper) Removed `remoteControl` state (Fenix API limitation)
* (meistermopper) Prevented ghost loops in polling process and improved adapter cleanup

## 0.0.24 (2026-06-16)
* (meistermopper) Added notification states for pre-heating and target temperature reached
* (meistermopper) Fixed `remoteControl` logic to correctly depend on `doorSafety`
* (meistermopper) Implemented a robust and stable local testing pipeline
* (meistermopper) Fixed release pipeline and code formatting issues

## 0.0.22 (2026-06-14)
* (meistermopper) Prepare clean 0.0.22 release

## 0.0.21 (2026-06-09)
* (meistermopper) Retry release due to deployment issues (v0.0.20 already exists).

## 0.0.20 (2026-06-09)
* (meistermopper) Retry release due to deployment issues.

## 0.0.19 (2026-06-09)
* (meistermopper) Final fixes for reviewer feedback, corrected i18n syntax and license format.
