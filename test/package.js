const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Validates the package files (package.json, io-package.json, structure)
tests.packageFiles(path.join(__dirname, '..'));
