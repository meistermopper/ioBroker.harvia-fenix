const path = require("node:path");
const { spawnSync } = require("node:child_process");

let mochaDir;
try {
	mochaDir = path.dirname(require.resolve("mocha/package.json"));
} catch {
	mochaDir = path.dirname(
		require.resolve("mocha/package.json", {
			paths: [require.resolve("@iobroker/testing")],
		}),
	);
}

const mochaBin = path.join(mochaDir, "bin", "mocha");
const result = spawnSync(
	process.execPath,
	[mochaBin, ...process.argv.slice(2)],
	{
		stdio: "inherit",
		env: process.env,
	},
);

process.exit(result.status ?? 1);
