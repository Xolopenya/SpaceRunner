export class Random {
  private value: number;

  constructor(seed: number) {
    this.value = seed >>> 0;
  }

  next(): number {
    this.value = (Math.imul(this.value, 1664525) + 1013904223) >>> 0;
    return this.value / 4294967296;
  }

  between(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
