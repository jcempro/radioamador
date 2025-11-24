const isNODE = typeof window === 'undefined';
const commom = isNODE
	? require(`../../../../../@assets/js/common${
			isNODE ? '.main' : ''
	  }.cjs`)
	: null;

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
