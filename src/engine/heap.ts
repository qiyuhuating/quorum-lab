/** Stable discrete-event queue: time first, insertion sequence for ties. */
export class Heap<T extends { at: number; seq: number }> {
  private items: T[] = [];
  private before(a: T, b: T) {
    return a.at < b.at || (a.at === b.at && a.seq < b.seq);
  }
  peek(): T | undefined {
    return this.items[0];
  }
  push(item: T) {
    this.items.push(item);
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.before(this.items[i], this.items[p])) break;
      [this.items[i], this.items[p]] = [this.items[p], this.items[i]];
      i = p;
    }
  }
  pop(): T | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      this.items[0] = last;
      let i = 0;
      while (true) {
        let next = i;
        for (const c of [i * 2 + 1, i * 2 + 2]) {
          if (c < this.items.length && this.before(this.items[c], this.items[next])) next = c;
        }
        if (next === i) break;
        [this.items[i], this.items[next]] = [this.items[next], this.items[i]];
        i = next;
      }
    }
    return first;
  }
}
