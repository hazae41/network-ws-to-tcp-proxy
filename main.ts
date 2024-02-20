// deno-lint-ignore-file no-empty

import { NetworkMixin, RpcErr, RpcError, RpcInvalidParamsError, RpcInvalidRequestError, RpcMethodNotFoundError, RpcOk, RpcRequestInit, base16_decode_mixed, base16_encode_lower, config, initBundledOnce, writeAll } from "./deps.ts";

config({ export: true, safe: true })

await initBundledOnce()

const chainIdString = Deno.env.get("CHAIN_ID")!
const contractZeroHex = Deno.env.get("CONTRACT_ZERO_HEX")!
const receiverZeroHex = Deno.env.get("RECEIVER_ZERO_HEX")!

const secretZeroHexSet = new Set<string>()

const chainIdNumber = Number(chainIdString)
const chainIdBase16 = chainIdNumber.toString(16).padStart(64, "0")
const chainIdMemory = base16_decode_mixed(chainIdBase16)

const contractBase16 = contractZeroHex.slice(2).padStart(64, "0")
const contractMemory = base16_decode_mixed(contractBase16)

const receiverBase16 = receiverZeroHex.slice(2).padStart(64, "0")
const receiverMemory = base16_decode_mixed(receiverBase16)

const mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory)

const balanceByUuid = new Map<string, bigint>()

async function onHttpRequest(request: Request) {
  if (request.headers.get("upgrade") !== "websocket")
    return new Response(undefined, { status: 400 })

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
    try { socket.close() } catch { }
    try { tcp.close() } catch { }
  }

  const onForward = async (bytes: Uint8Array) => {
    let balanceBigInt = balanceByUuid.get(session) || 0n
    balanceBigInt -= BigInt(bytes.length)
    balanceByUuid.set(session, balanceBigInt)

    if (balanceBigInt < 0n) {
      close()
      return
    }

    await writeAll(tcp, bytes)
  }

  const onBackward = (bytes: Uint8Array) => {
    let balanceBigInt = balanceByUuid.get(session) || 0n
    balanceBigInt -= BigInt(bytes.length)
    balanceByUuid.set(session, balanceBigInt)

    if (balanceBigInt < 0n) {
      close()
      return
    }

    socket.send(bytes)
  }

  const onMessage = (message: string) => {
    const request = JSON.parse(message) as RpcRequestInit
    socket.send(JSON.stringify(onRequest(request)))
  }

  const onRequest = (request: RpcRequestInit) => {
    try {
      return new RpcOk(request.id, routeOrThrow(request))
    } catch (e: unknown) {
      return new RpcErr(request.id, RpcError.rewrap(e))
    }
  }

  const routeOrThrow = (request: RpcRequestInit) => {
    if (request.method === "net_get")
      return onNetGet(request)
    if (request.method === "net_tip")
      return onNetTip(request)
    throw new RpcMethodNotFoundError()
  }

  const onNetGet = (_: RpcRequestInit) => {
    return { chainIdString, contractZeroHex, receiverZeroHex }
  }

  const onNetTip = (request: RpcRequestInit) => {
    const [secretZeroHexArray] = request.params as [string[]]

    if (secretZeroHexArray.length === 0)
      throw new RpcInvalidParamsError()
    if (secretZeroHexArray.length > 10)
      throw new RpcInvalidParamsError()

    let secretsBase16 = ""

    for (const secretZeroHex of secretZeroHexArray) {
      if (secretZeroHexSet.has(secretZeroHex))
        continue
      secretZeroHexSet.add(secretZeroHex)
      secretsBase16 += secretZeroHex.slice(2)
    }

    const secretsMemory = base16_decode_mixed(secretsBase16)

    const totalMemory = mixinStruct.verify_secrets(secretsMemory)
    const totalBase16 = base16_encode_lower(totalMemory)
    const totalZeroHex = `0x${totalBase16}`
    const totalBigInt = BigInt(totalZeroHex)

    if (totalBigInt < 16_384n)
      throw new RpcInvalidRequestError()

    let balanceBigInt = balanceByUuid.get(session) || 0n
    balanceBigInt += totalBigInt
    balanceByUuid.set(session, balanceBigInt)

    console.log(`Received ${totalBigInt.toString()} wei`)
    console.log(JSON.stringify(secretZeroHexArray))

    return totalBigInt.toString()
  }

  tcp.readable
    .pipeTo(new WritableStream({ write: onBackward }))
    .catch(() => close())

  socket.addEventListener("message", async (event) => {
    if (typeof event.data === "string")
      return onMessage(event.data)
    return await onForward(new Uint8Array(event.data))
  })

  socket.addEventListener("close", () => close())

  return response
}

Deno.serve({ hostname: "0.0.0.0", port: 8080 }, onHttpRequest);