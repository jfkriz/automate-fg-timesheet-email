import { getTargetWeekRange } from '../../src/utils/dateUtils';

describe('getTargetWeekRange', () => {
  it('returns previous Sunday-Saturday for a Wednesday reference', () => {
    const result = getTargetWeekRange(new Date('2026-05-06T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the just-completed week when reference is Saturday', () => {
    const result = getTargetWeekRange(new Date('2026-05-02T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the previous week when reference is Sunday', () => {
    const result = getTargetWeekRange(new Date('2026-05-03T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('returns the previous week when reference is Monday', () => {
    const result = getTargetWeekRange(new Date('2026-05-04T12:00:00'));
    expect(result).toEqual({ start: '2026-04-26', end: '2026-05-02' });
  });

  it('does not throw when called with no arguments', () => {
    expect(() => getTargetWeekRange()).not.toThrow();
  });
});
