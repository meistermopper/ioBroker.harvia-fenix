const fs = require('node:fs');
const path = require('node:path');

const psTreeFile = path.join(
	__dirname,
	'..',
	'node_modules',
	'ps-tree',
	'index.js',
);

if (fs.existsSync(psTreeFile)) {
	let content = fs.readFileSync(psTreeFile, 'utf8');
	if (content.includes("spawn('wmic.exe'")) {
		const target =
			"    processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);\n  } else {\n    processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);\n  }";
		const replacement =
			"    var psScript = \"$ProgressPreference = 'SilentlyContinue'; Write-Output 'Name  ParentProcessId  ProcessId  Status'; Get-CimInstance Win32_Process | ForEach-Object { Write-Output (\\\"{0}  {1}  {2}  OK\\\" -f ($_.Name -replace ' ','_'), $_.ParentProcessId, $_.ProcessId) }\";\n    var b64 = Buffer.from(psScript, 'utf16le').toString('base64');\n    processLister = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', b64]);\n  } else {\n    processLister = spawn('ps', ['-A', '-o', 'ppid,pid,stat,comm']);\n  }\n  processLister.on('error', callback);";

		if (content.includes(target)) {
			content = content.replace(target, replacement);
			fs.writeFileSync(psTreeFile, content, 'utf8');
			console.log(
				'[patch-ps-tree] Successfully patched ps-tree for Windows 11 compatibility.',
			);
		}
	}
}

const devServerIndex = path.join(
	__dirname,
	'..',
	'node_modules',
	'@iobroker',
	'dev-server',
	'dist',
	'index.js',
);
if (fs.existsSync(devServerIndex)) {
	let content = fs.readFileSync(devServerIndex, 'utf8');
	const crashTarget =
		"app.get('/', async (_req, res) => {\n                const { data } = await axios_1.default.get(adminUrl);\n                res.send((0, jsonConfig_1.injectCode)(data, this.adapterName, path.basename(jsonConfigFile)));\n            });";
	const resilientReplacement = `app.get('/', async (_req, res) => {
                let retries = 15;
                while (retries > 0) {
                    try {
                        const { data } = await axios_1.default.get(adminUrl);
                        return res.send((0, jsonConfig_1.injectCode)(data, this.adapterName, path.basename(jsonConfigFile)));
                    } catch (err) {
                        retries--;
                        if (retries === 0) {
                            return res.status(502).send('Admin is starting up. Please reload this page in a moment.');
                        }
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            });`;

	if (content.includes(crashTarget)) {
		content = content.replace(crashTarget, resilientReplacement);
		fs.writeFileSync(devServerIndex, content, 'utf8');
		console.log(
			'[patch-ps-tree] Successfully patched dev-server proxy for connection resilience.',
		);
	}
}

// Clean up stale jsonl lock directories from previous crashes
const dataDir = path.join(
	__dirname,
	'..',
	'.dev-server',
	'default',
	'iobroker-data',
);
if (fs.existsSync(dataDir)) {
	try {
		const entries = fs.readdirSync(dataDir);
		for (const entry of entries) {
			if (entry.endsWith('.lock')) {
				const lockPath = path.join(dataDir, entry);
				try {
					fs.rmSync(lockPath, { recursive: true, force: true });
					console.log(
						`[patch-ps-tree] Cleaned up stale lock: ${entry}`,
					);
				} catch (_) {
					// Ignore if locked by active process
				}
			}
		}
	} catch (_) {
		// Ignore readdir error
	}
}

// Patch js-controller in .dev-server so it never spawns a duplicate instance of harvia-fenix
const controllerFiles = [
	path.join(
		__dirname,
		'..',
		'.dev-server',
		'default',
		'node_modules',
		'iobroker.js-controller',
		'build',
		'esm',
		'main.js',
	),
	path.join(
		__dirname,
		'..',
		'.dev-server',
		'default',
		'node_modules',
		'iobroker.js-controller',
		'build',
		'cjs',
		'main.js',
	),
];

for (const ctrlFile of controllerFiles) {
	if (fs.existsSync(ctrlFile)) {
		let ctrlContent = fs.readFileSync(ctrlFile, 'utf8');
		const targetEsm =
			'async function startInstance(id, wakeUp = false) {\n    if (isStopping || !connected || !objects) {\n        return;\n    }';
		const replacementEsm =
			"async function startInstance(id, wakeUp = false) {\n    if (isStopping || !connected || !objects) {\n        return;\n    }\n    if (id === 'system.adapter.harvia-fenix.0' || id === 'harvia-fenix.0') {\n        return;\n    }";
		const targetCjs =
			'async function startInstance(id, wakeUp = false) {\n  if (isStopping || !connected || !objects) {\n    return;\n  }';
		const replacementCjs =
			"async function startInstance(id, wakeUp = false) {\n  if (isStopping || !connected || !objects) {\n    return;\n  }\n  if (id === 'system.adapter.harvia-fenix.0' || id === 'harvia-fenix.0') {\n    return;\n  }";

		let modified = false;
		if (ctrlContent.includes(targetEsm)) {
			ctrlContent = ctrlContent.replace(targetEsm, replacementEsm);
			modified = true;
		}
		if (ctrlContent.includes(targetCjs)) {
			ctrlContent = ctrlContent.replace(targetCjs, replacementCjs);
			modified = true;
		}
		if (modified) {
			fs.writeFileSync(ctrlFile, ctrlContent, 'utf8');
			console.log(
				`[patch-ps-tree] Successfully patched js-controller (${path.basename(path.dirname(ctrlFile))}) to prevent instance collision.`,
			);
		}
	}
}
