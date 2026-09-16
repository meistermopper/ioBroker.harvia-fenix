import { expect } from 'chai';
import { HarviaFenix } from './main';

describe('HarviaFenix utility methods', () => {
	describe('isTrue', () => {
		it('should return true for valid boolean-like values', () => {
			expect(HarviaFenix.isTrue(true)).to.be.true;
			expect(HarviaFenix.isTrue('true')).to.be.true;
			expect(HarviaFenix.isTrue('on')).to.be.true;
			expect(HarviaFenix.isTrue(1)).to.be.true;
			expect(HarviaFenix.isTrue('1')).to.be.true;
		});

		it('should return true for Harvia specific status codes', () => {
			expect(HarviaFenix.isTrue(21)).to.be.true;
			expect(HarviaFenix.isTrue('21')).to.be.true;
			expect(HarviaFenix.isTrue(23)).to.be.true;
			expect(HarviaFenix.isTrue('ready')).to.be.true;
		});

		it('should return false for falsy values', () => {
			expect(HarviaFenix.isTrue(false)).to.be.false;
			expect(HarviaFenix.isTrue('false')).to.be.false;
			expect(HarviaFenix.isTrue(0)).to.be.false;
			expect(HarviaFenix.isTrue(null)).to.be.false;
			expect(HarviaFenix.isTrue(undefined)).to.be.false;
			expect(HarviaFenix.isTrue('off')).to.be.false;
			expect(HarviaFenix.isTrue('unknown')).to.be.false;
		});
	});

	describe('calculateNumericValue', () => {
		it('should correctly scale and round values', () => {
			// Temperature rounding (1 decimal)
			expect(HarviaFenix.calculateNumericValue(25.678)).to.equal(25.7);
			// Power conversion (Watts to kW, 2 decimals)
			expect(HarviaFenix.calculateNumericValue(4500, 0.001, 2)).to.equal(4.5);
			expect(HarviaFenix.calculateNumericValue('4567', 0.001, 2)).to.equal(4.57);
		});

		it('should return undefined for invalid inputs', () => {
			expect(HarviaFenix.calculateNumericValue(null)).to.be.undefined;
			expect(HarviaFenix.calculateNumericValue(undefined)).to.be.undefined;
			expect(HarviaFenix.calculateNumericValue('not a number')).to.be.undefined;
		});
	});

	describe('formatTime and formatDuration', () => {
		it('should format a date to HH:mm string', () => {
			const testDate = new Date(2026, 0, 1, 17, 57, 0);
			expect(HarviaFenix.formatTime(testDate)).to.equal('17:57');
		});

		it('should format durations with minutes and seconds', () => {
			expect(HarviaFenix.formatDuration(39, 2370)).to.equal('39 min 30 sec');
			expect(HarviaFenix.formatDuration(30)).to.equal('30 min');
			expect(HarviaFenix.formatDuration(0)).to.equal('0 min');
		});
	});

	describe('calculateTimeFromHeatingCurve', () => {
		// 13 intervals from -20 to 110 (indexes 0 to 12)
		// Intervals: [-20..-10], [-10..0], [0..10], [10..20], [20..30], [30..40], [40..50], [50..60], [60..70], [70..80], [80..90], [90..100], [100..110]
		const sampleCurve = [
			300,
			300,
			300, // -20 to 10
			270, // 10 to 20
			283, // 20 to 30
			183, // 30 to 40
			216, // 40 to 50
			250, // 50 to 60
			593, // 60 to 70
			427, // 70 to 80
			364, // 80 to 90
			400,
			450, // 90 to 110
		];

		it('should accurately calculate minutes and seconds matching Harvia curve', () => {
			// From 18°C to 90°C:
			// 10..20: (20 - 18) / 10 * 270 = 54s
			// 20..30: 283s
			// 30..40: 183s
			// 40..50: 216s
			// 50..60: 250s
			// 60..70: 593s
			// 70..80: 427s
			// 80..90: 364s
			// Total seconds = 54 + 283 + 183 + 216 + 250 + 593 + 427 + 364 = 2370s = 39 min 30 sec
			const result = HarviaFenix.calculateTimeFromHeatingCurve(sampleCurve, 18, 90);
			expect(result).to.not.be.null;
			expect(result?.totalSeconds).to.equal(2370);
			expect(result?.minutes).to.equal(40); // 2370/60 rounded = 40
		});

		it('should return null if temperature is already reached or invalid curve', () => {
			expect(HarviaFenix.calculateTimeFromHeatingCurve(sampleCurve, 90, 80)).to.be.null;
			expect(HarviaFenix.calculateTimeFromHeatingCurve([], 20, 80)).to.be.null;
		});
	});
});
