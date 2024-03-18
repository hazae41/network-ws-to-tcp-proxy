import { Future } from "npm:@hazae41/future@1.0.3";

export class Semaphore<T> {

  #futures = new Array<Future<void>>()

  #count = 0

  constructor(
    readonly inner: T,
    readonly size: number
  ) { }

  async lock(callback: (inner: T) => Promise<void>) {
    try {
      this.#count++

      if (this.#count > this.size) {
        const future = new Future<void>()
        this.#futures.push(future)
        await future.promise
      }

      try {
        await callback(this.inner)
      } finally {
        this.#futures.shift()?.resolve()
      }
    } finally {
      this.#count--
    }
  }

}