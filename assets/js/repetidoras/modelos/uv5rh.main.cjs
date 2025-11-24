const isNODE = typeof window === 'undefined';

/**
 * Common utilities module import
 */
const commom = isNODE
	? require('../../common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

const MODEL = [
	'Location',
	'Name',
	'Frequency',
	'Duplex',
	'Offset',
	'Tone',
	'rToneFreq',
	'cToneFreq',
	'DtcsCode',
	'DtcsPolarity',
	'RxDtcsCode',
	'CrossMode',
	'Mode',
	'TStep',
	'Skip',
	'Power',
	'Comment',
	'URCALL',
	'RPT1CALL',
	'RPT2CALL',
	'DVCODE',
];
