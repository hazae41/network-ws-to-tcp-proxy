import { Semaphore } from "./mod.ts";

const semaphore = new Semaphore<void>(undefined, 1)

const tick = async () => {
  while (true) {
    console.log("tick")
    await new Promise(ok => setTimeout(ok, 100))
  }
}

const lock = (i: number) => semaphore.lock(async () => {
  console.log("start", i)
  await new Promise(ok => setTimeout(ok, 1000))
  console.log("end", i)
})

tick()
lock(1)
lock(2)
lock(3)
lock(4)
lock(5)
lock(6)
lock(7)
lock(8)
lock(9)
lock(10)