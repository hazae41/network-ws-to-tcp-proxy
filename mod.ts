import { writeAll } from "https://deno.land/std@0.216.0/io/mod.ts";
import { RpcErr, RpcInvalidParamsError, RpcInvalidRequestError, RpcMethodNotFoundError, RpcOk, RpcRequestInit } from "npm:@hazae41/jsonrpc";
import { NetworkMixin, base16_decode_mixed, base16_encode_lower, initBundledOnce } from "npm:@hazae41/network-bundle";

await initBundledOnce()

const chainIdNumber = 1
const contractZeroHex = "0xFf61BB11819455d58944A83e44b87E80CFC19eA2"
const receiverZeroHex = "0x39dfd20386F5d17eBa42763606B8c704FcDd1c1D"

const secretBase16Set = new Set<string>()

const chainIdBase16 = chainIdNumber.toString(16).padStart(64, "0")
const chainIdMemory = base16_decode_mixed(chainIdBase16)

const contractBase16 = contractZeroHex.slice(2).padStart(64, "0")
const contractMemory = base16_decode_mixed(contractBase16)

const receiverBase16 = receiverZeroHex.slice(2).padStart(64, "0")
const receiverMemory = base16_decode_mixed(receiverBase16)

const mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory)

async function onHttpRequest(request: Request) {
  if (request.headers.get("upgrade") !== "websocket")
    return new Response(undefined, { status: 400 })

  const url = new URL(request.url)

  const hostname = url.searchParams.get("hostname")
  const port = url.searchParams.get("port")

  if (!hostname)
    return new Response(undefined, { status: 400 })
  if (!port)
    return new Response(undefined, { status: 400 })

  const tcp = await Deno.connect({ hostname, port: Number(port) })

  const { socket, response } = Deno.upgradeWebSocket(request)

  socket.binaryType = "arraybuffer"

  let balanceBigInt = 0n

  const onForward = async (bytes: Uint8Array) => {
    balanceBigInt -= BigInt(bytes.length)

    if (balanceBigInt < 0n) {
      socket.close()
      tcp.close()
      return
    }

    await writeAll(tcp, bytes)
  }

  const onBackward = (bytes: Uint8Array) => {
    balanceBigInt += BigInt(bytes.length)

    if (balanceBigInt < 0n) {
      socket.close()
      tcp.close()
      return
    }

    socket.send(bytes)
  }

  const onMessage = (message: string) => {
    const request = JSON.parse(message) as RpcRequestInit

    if (request.method === "net_pay")
      return onPayment(request)

    socket.send(JSON.stringify(new RpcErr(request.id, new RpcMethodNotFoundError())))
  }

  const onPayment = (request: RpcRequestInit) => {
    const [secretBase16Array] = request.params as [string[]]

    if (secretBase16Array.length === 0) {
      socket.send(JSON.stringify(new RpcErr(request.id, new RpcInvalidParamsError())))
      return
    }

    if (secretBase16Array.length > 10) {
      socket.send(JSON.stringify(new RpcErr(request.id, new RpcInvalidParamsError())))
      return
    }

    let secretsBase16 = ""

    for (const secretBase16 of secretBase16Array) {
      if (secretBase16Set.has(secretBase16))
        continue
      secretBase16Set.add(secretBase16)
      secretsBase16 += secretBase16
    }

    const secretsMemory = base16_decode_mixed(secretsBase16)

    const totalMemory = mixinStruct.verify_secrets(secretsMemory)
    const totalBase16 = base16_encode_lower(totalMemory)
    const totalZeroHex = `0x${totalBase16}`
    const totalBigInt = BigInt(totalZeroHex)

    if (totalBigInt < 16_384n) {
      socket.send(JSON.stringify(new RpcErr(request.id, new RpcInvalidRequestError())))
      return
    }

    balanceBigInt += totalBigInt

    console.log(totalBigInt, secretsBase16)

    socket.send(JSON.stringify(new RpcOk(request.id, balanceBigInt.toString())))
  }

  tcp.readable
    .pipeTo(new WritableStream({ write: onBackward }))
    .catch(() => socket.close())

  socket.addEventListener("message", async (event) => {
    if (typeof event.data === "string")
      return onMessage(event.data)
    return await onForward(new Uint8Array(event.data))
  })

  socket.addEventListener("close", () => tcp.close())

  return response
}

Deno.serve(onHttpRequest);