import iobrokerConfig from "@iobroker/eslint-config";

export default [
	...iobrokerConfig,
	{
		ignores: ["build/**", "node_modules/**"],
	},
];
