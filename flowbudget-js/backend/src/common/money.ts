import type { ValueTransformer } from 'typeorm';

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const sumMoney = (values: number[]) => roundMoney(values.reduce((acc, v) => acc + v, 0));

// pg returns NUMERIC as string to avoid precision loss; amounts here fit comfortably in a double.
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number.parseFloat(value)),
};
