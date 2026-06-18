// This script configures and runs Mocha programmatically to avoid all CLI issues.

const path = require("node:path");
const fs = require("node:fs");

// 0. Resolve Mocha dynamically
// Since the ioBroker Bot requires removing 'mocha' from devDependencies,
// we resolve it directly from the @iobroker/testing package dependencies.
let Mocha;
try {
	Mocha = require("mocha");
} catch {
	Mocha = require(
		require.resolve("mocha", { paths: [require.resolve("@iobroker/testing")] }),
	);
}

// 1. Mock @iobroker/adapter-core to prevent the "Cannot find js-controller" error.
// Since we only test static utility methods, we don't need the real ioBroker engine.
const adapterCorePath = require.resolve("@iobroker/adapter-core");
require.cache[adapterCorePath] = {
	id: adapterCorePath,
	filename: adapterCorePath,
	loaded: true,
	exports: {
		Adapter: class Adapter {
			constructor() {
				this.on = () => {};
			}
		},
	},
};

// 2. Configure ts-node to force CommonJS for tests, bypassing all other configs.
require("ts-node").register({
	transpileOnly: true,
	compilerOptions: {
		module: "commonjs",
		ignoreDeprecations: "6.0",
	},
});

// 3. Create a new Mocha instance
const mocha = new Mocha();

// 4. Add the test file to the Mocha instance
const testFile = path.join(__dirname, "..", "src", "main.test.ts");
if (fs.existsSync(testFile)) {
	mocha.addFile(testFile);
}

// 5. Run the tests and exit with the correct status code
mocha.run((failures) => process.exit(failures ? 1 : 0));
