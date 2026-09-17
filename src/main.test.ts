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

	describe('Events & Safety Hub methods', () => {
		describe('parseEvents', () => {
			it('should parse direct arrays of events', () => {
				const events = [
					{ id: 'evt-1', type: 'DOOR' },
					{ id: 'evt-2', type: 'HEATER' },
				];
				expect(HarviaFenix.parseEvents(events)).to.deep.equal(events);
			});

			it('should extract events from wrapped object formats', () => {
				expect(HarviaFenix.parseEvents({ events: [{ id: '1' }] })).to.deep.equal([{ id: '1' }]);
				expect(HarviaFenix.parseEvents({ items: [{ id: '2' }] })).to.deep.equal([{ id: '2' }]);
				expect(HarviaFenix.parseEvents({ data: [{ id: '3' }] })).to.deep.equal([{ id: '3' }]);
				expect(HarviaFenix.parseEvents({ data: { events: [{ id: '4' }] } })).to.deep.equal([{ id: '4' }]);
			});

			it('should handle single event objects and invalid inputs', () => {
				expect(HarviaFenix.parseEvents({ eventId: '5', type: 'INFO' })).to.deep.equal([
					{ eventId: '5', type: 'INFO' },
				]);
				expect(HarviaFenix.parseEvents(null)).to.deep.equal([]);
				expect(HarviaFenix.parseEvents(undefined)).to.deep.equal([]);
				expect(HarviaFenix.parseEvents({})).to.deep.equal([]);
			});
		});

		describe('getEventTimestamp', () => {
			it('should convert millisecond and second timestamps properly', () => {
				const ms = 1758117600000;
				expect(HarviaFenix.getEventTimestamp({ timestamp: ms })).to.equal(ms);
				expect(HarviaFenix.getEventTimestamp({ createdAt: ms / 1000 })).to.equal(ms);
			});

			it('should parse ISO date strings', () => {
				const iso = '2026-09-17T16:00:00.000Z';
				expect(HarviaFenix.getEventTimestamp({ time: iso })).to.equal(Date.parse(iso));
			});

			it('should fallback to 0 for missing or invalid timestamps', () => {
				expect(HarviaFenix.getEventTimestamp({})).to.equal(0);
				expect(HarviaFenix.getEventTimestamp({ timestamp: 'invalid' })).to.equal(0);
			});
		});

		describe('determineEventSeverity', () => {
			it('should map explicit severity levels correctly', () => {
				expect(HarviaFenix.determineEventSeverity({ severity: 'critical' })).to.equal('critical');
				expect(HarviaFenix.determineEventSeverity({ severity: 'error' })).to.equal('error');
				expect(HarviaFenix.determineEventSeverity({ severity: 'warn' })).to.equal('warn');
				expect(HarviaFenix.determineEventSeverity({ severity: 'info' })).to.equal('info');
			});

			it('should infer severity from keywords when not explicitly given', () => {
				expect(HarviaFenix.determineEventSeverity({ type: 'OVERHEAT_PROTECTION' })).to.equal('critical');
				expect(HarviaFenix.determineEventSeverity({ message: 'Heater sensor fault' })).to.equal('error');
				expect(HarviaFenix.determineEventSeverity({ type: 'DOOR_OPEN' })).to.equal('warn');
				expect(HarviaFenix.determineEventSeverity({ type: 'SESSION_START' })).to.equal('info');
			});
		});

		describe('evaluateSafetyStatus', () => {
			it('should return tripped: false for empty or benign events', () => {
				expect(HarviaFenix.evaluateSafetyStatus([])).to.deep.equal({ tripped: false, reason: '' });
				expect(
					HarviaFenix.evaluateSafetyStatus([
						{ type: 'STATUS', message: 'Target temp reached', timestamp: Date.now() },
					]),
				).to.deep.equal({ tripped: false, reason: '' });
			});

			it('should detect safety interlock trips from recent events', () => {
				const now = Date.now();
				const result = HarviaFenix.evaluateSafetyStatus([
					{
						type: 'SAFETY_INTERLOCK',
						message: 'Door safety loop opened during heating',
						timestamp: now - 60000,
					},
				]);
				expect(result.tripped).to.be.true;
				expect(result.reason).to.equal('Door safety loop opened during heating');
			});

			it('should ignore safety trips older than 2 hours', () => {
				const oldTimestamp = Date.now() - 3 * 60 * 60 * 1000;
				const result = HarviaFenix.evaluateSafetyStatus([
					{
						type: 'SAFETY_SWITCH',
						message: 'Thermal fuse triggered',
						timestamp: oldTimestamp,
					},
				]);
				expect(result.tripped).to.be.false;
			});
		});
	});
});
