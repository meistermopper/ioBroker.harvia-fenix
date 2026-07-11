import config from '@iobroker/eslint-config';

export default [
	...config,
	{
		ignores: ['build/**', 'node_modules/**'],
	},
];
