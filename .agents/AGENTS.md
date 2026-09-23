# ioBroker Development Rules for harvia-fenix

This file defines style guidelines, constraints, and general instructions for AI agents working on the `iobroker.harvia-fenix` codebase to ensure 100% ioBroker conformity, safety, and stability.

## 1. Asynchronous Error Handling & Logging Rules (Crash Prevention & Compliance)
- **Constraint:** All asynchronous API calls, network requests (e.g., Axios), and database operations must be wrapped in `try/catch` blocks or have `.catch()` handlers. Unhandled promise rejections must be avoided at all costs to prevent crash loops.
- **Example:**
  ```typescript
  try {
      const response = await this.client.get("/devices");
  } catch (error: any) {
      this.log.error(`API Call failed: ${error.message}`);
  }
  ```
- **Event Handlers:** Ensure main entry points like `onReady`, `onStateChange`, and `onUnload` capture all internal errors and log them cleanly instead of crashing the process.
- **Sensitive Data Logging:** Sensitive information MUST NOT be written to log files under any circumstances (including `info`, `warn`, or `debug`). Sensitive data includes any values configured in `io-package.json` under `protectedNative` or `encryptedNative` (e.g., passwords, API tokens, secret keys).
- **Log Message Language:** All log messages must be written strictly in pure English text and MUST NOT use any translation mechanism (e.g. `this.t()`).

## 2. Object & State Management
- **Rule:** Never call `this.setState()` or `this.setStateAsync()` on states that do not exist in the ioBroker object database.
- **Static States:** If a state is static, it must be defined in [io-package.json](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/io-package.json) under `instanceObjects` first.
- **Dynamic States:** If states are created dynamically (e.g., during polling or device discovery), you MUST call `this.setObjectNotExistsAsync()` before calling `this.setStateAsync()`.
- **Strict Metadata:** Every new object configuration must contain a valid `common` section specifying:
  - `type` (e.g., `'string'`, `'number'`, `'boolean'`)
  - `role` (must be a standard ioBroker role like `'value.temperature'`, `'switch.power'`, etc.)
  - `read` and `write` flags
  - `def` (default value corresponding to the data type)
  - `name` / `desc`: `common.name` and `common.desc` must use either English wording or an i18n multilanguage setup.
- **Object ID Validation & Character Filtering:** Object IDs must not contain special characters, spaces, or non-ASCII characters. At minimum, characters defined by the ioBroker constant `FORBIDDEN_CHARS` must be removed or sanitized. Spaces should be converted to underscores (`_`) or removed. Strictly allow only `A-Za-z0-9-_` (and `.` as separator).
- **State ID Naming:** All `stateId`s must be named using English wording unless the raw data key is directly received from an external API/source.
- **Explicit Hierarchy:** When creating an object tree dynamically (e.g., `device.channel.state`), you must explicitly create every parent object in the hierarchy (i.e., first the `device` object, then the `channel` object, and finally the `state` object).

## 3. The `ack` Flag Protocol
- **Sensor/Cloud Updates (`ack: true`):** When updating states with values received from the Harvia API or hardware status, always set `ack: true` to indicate that the state represents the confirmed current value.
  - *Example:* `await this.setStateAsync("temp", currentVal, true);`
- **User Commands (`ack: false`):** When reacting to state changes triggered by the user (where `state.ack === false` in `onStateChange`), perform the required API action. Upon success, update the state with `ack: true` to confirm the command execution.

## 4. Resource Lifecycle Management (Memory Cleanups)
- **Constraint:** All active intervals, timeouts, and event listeners must be properly cleaned up in the `onUnload` method of the adapter.
- **Timers:** **NEVER** use Node.js global functions `setTimeout` or `setInterval`. You must always use the adapter-safe methods `this.setTimeout()` or `this.setInterval()`, or store references and clear them explicitly during unload.

## 5. Process Lifecycle Constraints
- **Constraint:** **NEVER** call `process.exit()` within the adapter code. If the adapter needs to be terminated or stopped due to a fatal error, you must call `this.terminate()` (or `this.terminate(reason, exitCode)`) instead.

## 6. Config UI & Internationalization (i18n)
- **Constraint:** Do not create manual HTML panels (`admin/index_m.html`). Always use **JSONConfig** (`admin/jsonConfig.json` or `admin/jsonConfig.json5`).
- **Translation:** Never write direct/hardcoded translations in `jsonConfig`. Always configure `"i18n": true` and use standard language translation keys corresponding to files in the `admin/i18n` directory.
- **User Text Output:** All text output displayed to users must either use pure English text or support at least English and German text (via i18n).
- **News & Metadata Translations (`io-package.json`):** Every entry under `common.news` in `io-package.json` MUST be fully translated into all supported languages (`en`, `de`, `ru`, `pt`, `nl`, `fr`, `it`, `es`, `pl`, `uk`, `zh-cn`). Never leave non-English keys identical to English text, as ioBroker repochecker flags untranslated `common.news` entries as error `[E1144]`.

## 7. Local Code Verification
- **Workflow:** Before finishing any code modification or pushing, run:
  ```bash
  npm run test:local
  ```
  This command runs `biome check`, TypeScript compilation (`tsc --noEmit`), and the package/unit/integration tests. Make sure all checks pass.
- **Troubleshooting (Windows Integration Tests):** If integration tests fail with `Unknown packet name harvia-fenix` (often caused by file locks or cache corruption in the temporary directories on Windows), delete the temp test directory:
  `Remove-Item -Recurse -Force $env:TEMP\test-iobroker.harvia-fenix` (PowerShell) or `rmdir /s /q %TEMP%\test-iobroker.harvia-fenix` (CMD).

## 8. Node.js Built-in Module Imports (Biome Conformity)
- **Constraint:** When requiring or importing Node.js built-in modules (e.g., `fs`, `path`, `os`, `crypto`), you must always use the `node:` protocol prefix.
- **Examples:**
  ```javascript
  const fs = require('node:fs');
  const path = require('node:path');
  ```
  This is required to comply with the project's Biome linting rules (`useNodejsImportProtocol`).

## 9. Documentation & Changelog Guidelines (README, WIP Check & Docs Sync)
- **Strict README Language Separation:** `README.md` MUST be written using pure English text and must not mix languages. German text is strictly confined to `README_de.md` (or `README.de.md`).
- **Strict Privacy & Anonymization:** NEVER include real personal data, private email addresses, passwords, tokens, API keys, or real hardware/device IDs (e.g., real UUIDs, serial numbers, MAC addresses) in any documentation files (`README.md`, `README_de.md`, `docs/`, examples, scripts). ALWAYS use obvious anonymized placeholders (e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`, `user@example.com`, `00:11:22:33:44:55`).
- **WIP Changelog Constraint:** Whenever you make changes to the repository (source code, documentation, scripts), you MUST add a descriptive bullet point of your changes under the `### **WORK IN PROGRESS**` section in both [README.md](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/README.md) and [README_de.md](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/README_de.md).
- **Line Length Constraint:** Each line under the `### **WORK IN PROGRESS**` section must be strictly less than **100 characters** in length. The git release commit uses commitlint (`body-max-line-length`), which will reject commits with changelog lines exceeding this limit, aborting and rolling back the release.
- **Documentation Synchronization (`sync-docs.js`):** Whenever `README.md` or `README_de.md` is updated, always run `node scripts/sync-docs.js`. This script synchronizes root READMEs into `docs/en/README.md` and `docs/de/README.md`, rewrites internal relative links, and ensures documentation parity.
- **WIP Verification (`check-wip.js`):** Always verify the WIP changelog before committing by running `node scripts/check-wip.js`. It checks that the `### **WORK IN PROGRESS**` section exists and contains at least one non-empty entry in both README files.
- **Clean Worktree for Releases:** Ensure all working tree changes are committed or stashed before running `npm run release`. Because the release build process dynamically updates the `docs` directory, always run release with the `--all` option (`npm run release -- --all`).

## 10. Git Commit & Push Authorization and Workflow
- **Constraint:** AI agents MUST NEVER perform `git commit` or `git push` operations automatically without explicit, prior user approval in the chat.
- **Workflow:** Always prepare code modifications locally and ask the user for explicit confirmation before staging, committing, or pushing changes to remote repositories.
- **Standard Commit & Push Procedure:** Once explicit user approval is received, execute the following steps in sequence:
  1. **Maintain WIP:** Ensure both [README.md](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/README.md) and [README_de.md](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/README_de.md) have entries under `### **WORK IN PROGRESS**` (< 100 chars/line).
  2. **Synchronize Docs:** Run `node scripts/sync-docs.js` to update `docs/`.
  3. **Verify WIP:** Run `node scripts/check-wip.js` to ensure the changelog check passes.
  4. **Run Verification / Tests:** Run `npm run test:local` to ensure Biome, TypeScript compiler, and tests all pass cleanly.
  5. **Stage & Commit:** Stage all modified and generated files (`git add -A`) and commit with a Conventional Commit message (e.g. `fix: ...`, `feat: ...`, `docs: ...`). Note: The `pre-commit` Husky hook will execute `npm run lint`.
  6. **Push to Remote:** Run `git push`. Note: The `pre-push` Husky hook will execute `npm run test:local`. If rejected due to upstream changes (`non-fast-forward`), run `git pull --rebase` and push again.

## 11. Active Links for References (Commits, Releases, Issues, Files)
- **Constraint:** Whenever referencing commits, releases, issues, PRs, external resources, or workspace files (in chat, documentation, or Obsidian project notes/logbooks), always format them as active, clickable Markdown links instead of plain text or simple inline code tags.
- **Examples:**
  - Commits: `[1f815d3](https://github.com/meistermopper/ioBroker.harvia-fenix/commit/1f815d3)`
  - Releases: `[v0.5.1](https://github.com/meistermopper/ioBroker.harvia-fenix/releases/tag/v0.5.1)`
  - Issues / PRs: `[#69](https://github.com/meistermopper/ioBroker.harvia-fenix/issues/69)`
  - Files: Clickable markdown links (e.g. `[admin/fenix.png](file:///c:/Users/thoma/dev/active/ioBroker.harvia-fenix/admin/fenix.png)` in chat or GitHub file link in remote notes).
