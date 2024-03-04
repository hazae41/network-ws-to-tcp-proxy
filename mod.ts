// deno-lint-ignore-file no-empty require-await
import * as Dotenv from "https://deno.land/std@0.217.0/dotenv/mod.ts";
import * as Io from "https://deno.land/std@0.217.0/io/mod.ts";
import { Future } from "npm:@hazae41/future@1.0.3";
import { RpcErr, RpcError, RpcInvalidParamsError, RpcMethodNotFoundError, RpcOk, RpcRequestInit } from "npm:@hazae41/jsonrpc@1.0.5";
import { Mutex } from "npm:@hazae41/mutex@1.2.12";
import { Memory, NetworkMixin, base16_decode_mixed, base16_encode_lower, initBundledOnce } from "npm:@hazae41/network-bundle@1.2.1";
import * as Ethers from "npm:ethers";
import Abi from "./token.abi.json" with { type: "json" };

export async function main() {
  const envPath = new URL(import.meta.resolve("./.env.local")).pathname

  const {
    PRIVATE_KEY_ZERO_HEX = Deno.env.get("PRIVATE_KEY_ZERO_HEX"),
  } = await Dotenv.load({ envPath, examplePath: null })

  if (PRIVATE_KEY_ZERO_HEX == null)
    throw new Error("PRIVATE_KEY_ZERO_HEX is not set")

  const privateKeyZeroHex = PRIVATE_KEY_ZERO_HEX

  return await serve({ privateKeyZeroHex })
}

export async function serve(params: {
  privateKeyZeroHex: string
}) {
  const { privateKeyZeroHex } = params

  await initBundledOnce()

  const chainIdString = "100"
  const chainIdNumber = Number(chainIdString)
  const chainIdBase16 = chainIdNumber.toString(16).padStart(64, "0")
  const chainIdMemory = base16_decode_mixed(chainIdBase16)

  const contractZeroHex = "0x0a4d5EFEa910Ea5E39be428A3d57B80BFAbA52f4"
  const contractBase16 = contractZeroHex.slice(2).padStart(64, "0")
  const contractMemory = base16_decode_mixed(contractBase16)

  const provider = new Ethers.JsonRpcProvider("https://gnosis-rpc.publicnode.com")
  const wallet = new Ethers.Wallet(privateKeyZeroHex).connect(provider)
  const contract = new Ethers.Contract(contractZeroHex, Abi, wallet)

  const receiverZeroHex = wallet.address
  const receiverBase16 = receiverZeroHex.slice(2).padStart(64, "0")
  const receiverMemory = base16_decode_mixed(receiverBase16)

  const nonceBytes = crypto.getRandomValues(new Uint8Array(32))
  const nonceMemory = new Memory(nonceBytes)
  const nonceBase16 = base16_encode_lower(nonceMemory)
  const nonceZeroHex = `0x${nonceBase16}`

  const mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory, nonceMemory)

  const allSecretZeroHexSet = new Set<string>()

  let pendingSecretZeroHexArray = new Array<string>()
  let pendingTotalValueBigInt = 0n

  const mutex = new Mutex(undefined)

  let minimumBigInt = 2n ** 16n
  let minimumBase16 = minimumBigInt.toString(16).padStart(64, "0")
  let minimumZeroHex = `0x${minimumBase16}`

  const balanceByUuid = new Map<string, bigint>()

  const onHttpRequest = async (request: Request) => {
    if (request.headers.get("upgrade") !== "websocket")
      return new Response("Bad Request", { status: 400 })

    const url = new URL(request.url)

    const session = url.searchParams.get("session")
    const hostname = url.searchParams.get("hostname")
    const port = url.searchParams.get("port")

    if (!session)
      return new Response("Bad Request", { status: 400 })
    if (!hostname)
      return new Response("Bad Request", { status: 400 })
    if (!port)
      return new Response("Bad Request", { status: 400 })

    const tcp = await Deno.connect({ hostname, port: Number(port) })

    const { socket, response } = Deno.upgradeWebSocket(request)

    socket.binaryType = "arraybuffer"

    const close = () => {
      try {
        socket.close()
      } catch { }

      try {
        tcp.close()
      } catch { }
    }

    const onForward = async (bytes: Uint8Array) => {
      let [balanceBigInt = 0n] = [balanceByUuid.get(session)]
      balanceBigInt = balanceBigInt - BigInt(bytes.length)
      balanceByUuid.set(session, balanceBigInt)

      if (balanceBigInt < 0n) {
        close()
        return
      }

      try {
        await Io.writeAll(tcp, bytes)
      } catch { }
    }

    const onBackward = (bytes: Uint8Array) => {
      let [balanceBigInt = 0n] = [balanceByUuid.get(session)]
      balanceBigInt = balanceBigInt - BigInt(bytes.length)
      balanceByUuid.set(session, balanceBigInt)

      if (balanceBigInt < 0n) {
        close()
        return
      }

      try {
        socket.send(bytes)
      } catch { }
    }

    const onMessage = async (message: string) => {
      try {
        const request = JSON.parse(message) as RpcRequestInit
        socket.send(JSON.stringify(await onRequest(request)))
      } catch (e: unknown) {
        console.error(e)
      }
    }

    const onRequest = async (request: RpcRequestInit) => {
      try {
        return new RpcOk(request.id, await routeOrThrow(request))
      } catch (e: unknown) {
        return new RpcErr(request.id, RpcError.rewrap(e))
      }
    }

    const routeOrThrow = async (request: RpcRequestInit) => {
      if (request.method === "net_get")
        return await onNetGet(request)
      if (request.method === "net_tip")
        return await onNetTip(request)
      throw new RpcMethodNotFoundError()
    }

    const onNetGet = async (_: RpcRequestInit) => {
      return { chainIdString, contractZeroHex, receiverZeroHex, nonceZeroHex, minimumZeroHex }
    }

    const onNetTip = async (request: RpcRequestInit) => {
      const [secretZeroHex] = request.params as [string]

      if (typeof secretZeroHex !== "string")
        throw new RpcInvalidParamsError()
      if (secretZeroHex.length !== 66)
        throw new RpcInvalidParamsError()
      if (allSecretZeroHexSet.has(secretZeroHex))
        throw new RpcInvalidParamsError()

      allSecretZeroHexSet.add(secretZeroHex)

      const secretBase16 = secretZeroHex.slice(2).padStart(64, "0")
      const secretMemory = base16_decode_mixed(secretBase16)

      const valueMemory = mixinStruct.verify_secret(secretMemory)
      const valueBase16 = base16_encode_lower(valueMemory)
      const valueZeroHex = `0x${valueBase16}`
      const valueBigInt = BigInt(valueZeroHex)

      if (valueBigInt < minimumBigInt)
        throw new RpcInvalidParamsError()

      const [balanceBigInt = 0n] = [balanceByUuid.get(session)]
      balanceByUuid.set(session, balanceBigInt + valueBigInt)

      console.log(`Received ${valueBigInt.toString()} wei`)

      pendingSecretZeroHexArray.push(secretZeroHex)
      pendingTotalValueBigInt += valueBigInt

      const claim = async (pendingTotalValueBigInt: bigint, pendingSecretZeroHexArray: string[]) => {
        const backpressure = mutex.locked

        if (backpressure) {
          minimumBigInt = minimumBigInt * 2n
          minimumBase16 = minimumBigInt.toString(16).padStart(64, "0")
          minimumZeroHex = `0x${minimumBase16}`

          console.log(`Increasing minimum to ${minimumBigInt.toString()} wei`)
        }

        await mutex.lock(async () => {
          if (backpressure) {
            minimumBigInt = minimumBigInt / 2n
            minimumBase16 = minimumBigInt.toString(16).padStart(64, "0")
            minimumZeroHex = `0x${minimumBase16}`

            console.log(`Decreasing minimum to ${minimumBigInt.toString()} wei`)
          }

          const nonce = await wallet.getNonce("latest")

          while (true) {
            const signal = AbortSignal.timeout(15000)
            const future = new Future<never>()

            const onAbort = () => future.reject(new Error("Aborted"))

            try {
              signal.addEventListener("abort", onAbort, { passive: true })

              console.log(`Claiming ${pendingTotalValueBigInt.toString()} wei`)
              const responsePromise = contract.claim(nonceZeroHex, pendingSecretZeroHexArray, { nonce })
              const response = await Promise.race([responsePromise, future.promise])

              console.log(`Waiting for ${response.hash} on ${response.nonce}`)
              const receipt = await Promise.race([response.wait(), future.promise])

              return receipt
            } catch (e: unknown) {
              if (signal.aborted)
                continue
              throw e
            } finally {
              signal.removeEventListener("abort", onAbort)
            }
          }
        })
      }

      const warn = (e: unknown) => {
        if (e == null) {
          console.error("ERROR", e)
          return
        }

        if (typeof e !== "object") {
          console.error("ERROR", e)
          return
        }

        if ("info" in e) {
          warn(e.info)
          return
        }

        if ("error" in e) {
          warn(e.error)
          return
        }

        if ("message" in e) {
          console.error("ERROR", e.message)
          return
        }

        console.error("ERROR", e)
      }

      if (pendingSecretZeroHexArray.length > 640) {
        claim(pendingTotalValueBigInt, pendingSecretZeroHexArray).catch(warn)

        pendingSecretZeroHexArray = new Array<string>()
        pendingTotalValueBigInt = 0n
      }

      return valueBigInt.toString()
    }

    tcp.readable
      .pipeTo(new WritableStream({ write: onBackward }))
      .catch(() => close())

    socket.addEventListener("message", async (event) => {
      if (typeof event.data === "string")
        return await onMessage(event.data)
      return await onForward(new Uint8Array(event.data))
    })

    socket.addEventListener("close", () => close())

    return response
  }

  return { onHttpRequest }
}