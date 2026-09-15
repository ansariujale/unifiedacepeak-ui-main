import moment from 'moment';

/**
 * How a range is cut for a chart: hours for a single day, days for a longer
 * range, weeks once a custom range would draw too many bars to read.
 */
export const makeBucketing = (range: { from: string; to: string }) => {
  const from = moment(range.from, 'YYYY-MM-DD').startOf('day');
  const to = moment(range.to, 'YYYY-MM-DD').endOf('day');
  const days = Math.max(1, to.diff(from, 'days') + 1);

  if (days === 1) {
    return {
      unit: 'hour' as const,
      size: 24,
      indexOf: (row: any) => {
        const stamp = moment(row?.start_stamp);
        return stamp.isValid() ? stamp.hour() : -1;
      },
      labelOf: (index: number) => moment().startOf('day').add(index, 'hours').format('h A'),
    };
  }

  const step = days > 62 ? 7 : 1;
  return {
    unit: step === 7 ? ('week' as const) : ('day' as const),
    size: Math.ceil(days / step),
    indexOf: (row: any) => {
      const stamp = moment(row?.start_stamp);
      return stamp.isValid()
        ? Math.floor(stamp.clone().startOf('day').diff(from, 'days') / step)
        : -1;
    },
    labelOf: (index: number) =>
      from
        .clone()
        .add(index * step, 'days')
        .format('MMM D'),
  };
};

export type Bucketing = ReturnType<typeof makeBucketing>;

export const countInto = (bucketing: Bucketing, rows: any[]) => {
  const counts = Array.from({ length: bucketing.size }, () => 0);
  rows.forEach((row) => {
    const index = bucketing.indexOf(row);
    if (index >= 0 && index < counts.length) counts[index] += 1;
  });
  return counts;
};

/** The mean of `valueOf` per bucket; a bucket with nothing in it is `null`, not 0. */
export const averageInto = (
  bucketing: Bucketing,
  rows: any[],
  valueOf: (row: any) => number | null,
) => {
  const sums = Array.from({ length: bucketing.size }, () => 0);
  const counts = Array.from({ length: bucketing.size }, () => 0);
  rows.forEach((row) => {
    const index = bucketing.indexOf(row);
    const value = valueOf(row);
    if (index < 0 || index >= sums.length || value === null) return;
    sums[index] += value;
    counts[index] += 1;
  });
  return sums.map((sum, index) => (counts[index] ? sum / counts[index] : null));
};

/** Five evenly spread tick positions, deduplicated for short series. */
export const axisTicksFor = (size: number) => {
  const last = size - 1;
  return Array.from(
    new Set([0, Math.round(last / 4), Math.round(last / 2), Math.round((3 * last) / 4), last]),
  );
};
