# ioBroker Development Rules for harvia-fenix

This file defines style guidelines, constraints, and general instructions for AI agents working on the `iobroker.harvia-fenix` codebase to ensure 100% ioBroker conformity, safety, and stability.

## 1. Asynchronous Error Handling (Crash Prevention)
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

## 2. Object & State Management
- **Rule:** Never call `this.setState()` or `this.setStateAsync()` on states that do not exist in the ioBroker object database.
- **Static States:** If a state is static, it must be defined in [io-package.json](file:///c:/Users/thoma/dev/Harvia_Fenix/iobroker.harvia-fenix/io-package.json) under `instanceObjects` first.
- **Dynamic States:** If states are created dynamically (e.g., during polling or device discovery), you MUST call `this.setObjectNotExistsAsync()` before calling `this.setStateAsync()`.
- **Strict Metadata:** Every new object configuration must contain a valid `common` section specifying:
  - `type` (e.g., `'string'`, `'number'`, `'boolean'`)
  - `role` (must be a standard ioBroker role like `'value.temperature'`, `'switch.power'`, etc.)
  - `read` and `write` flags
  - `def` (default value corresponding to the data type)
- **Object ID Validation:** Object IDs must not contain special characters, spaces, or non-ASCII characters. They should ideally only contain `A-Za-z0-9-_` (and `.` as separator).
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

## 9. Changelog & Release Guidelines (WIP Check Prevention)
- **Constraint:** Whenever you make changes to the repository (source code, documentation, scripts), you MUST add a descriptive bullet point of your changes under the `### **WORK IN PROGRESS**` section in both [README.md](file:///c:/Users/thoma/dev/Harvia_Fenix/iobroker.harvia-fenix/README.md) and [README_de.md](file:///c:/Users/thoma/dev/Harvia_Fenix/iobroker.harvia-fenix/README_de.md).
- **Line Length Constraint:** Each line under the `### **WORK IN PROGRESS**` section must be strictly less than **100 characters** in length. The git release commit uses commitlint (`body-max-line-length`), which will reject commits with changelog lines exceeding this limit, aborting and rolling back the release.
- **Clean Worktree:** Ensure all working tree changes are committed or stashed before running `npm run release`. Because the build process dynamically updates the `docs` directory (which Git may detect as modified due to line endings or regeneration), you should run the release command with the `--all` option (i.e. `npm run release -- --all`) to include these generated files in the release commit.
- **Why:** The release script executes a verification script (`check-wip.js`) which fails if the WIP section is empty, and checks that no uncommitted files exist before proceeding, blocking the build otherwise.



