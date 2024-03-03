import { RpcCounter, RpcRequest, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "npm:@hazae41/jsonrpc@1.0.5";
import { NetworkMixin, base16_decode_mixed, base16_encode_lower, initBundledOnce } from "npm:@hazae41/network-bundle@1.2.1";

await initBundledOnce()

while (true) {
  const session = crypto.randomUUID()
  const hostname = "5.9.66.94"
  const port = 54782

  const socket = new WebSocket(`wss://ws-to-tcp.node0.hazae41.me/?session=${session}&hostname=${hostname}&port=${port}`)

  socket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    socket.addEventListener("open", ok)
    socket.addEventListener("error", err)
  })

  const counter = new RpcCounter()
  const events = new EventTarget()

  const onRequest = (request: RpcRequest<unknown>) => {
    events.dispatchEvent(new CustomEvent("request", { detail: request }))
  }

  const onResponse = (response: RpcResponse<unknown>) => {
    events.dispatchEvent(new CustomEvent("response", { detail: response }))
  }

  const onMessage = (message: string) => {
    const requestOrResponse = JSON.parse(message) as RpcRequest<unknown> | RpcResponse

    if ("method" in requestOrResponse)
      return onRequest(requestOrResponse)

    return onResponse(requestOrResponse)
  }

  const onBytes = (bytes: Uint8Array) => {
    events.dispatchEvent(new CustomEvent("bytes", { detail: bytes }))
  }

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string")
      return onMessage(event.data)
    return onBytes(new Uint8Array(event.data))
  })

  const requestOrThrow = <T>(preinit: RpcRequestPreinit<unknown>) => {
    const request = counter.prepare(preinit)

    socket.send(JSON.stringify(request))

    return new Promise<RpcResponse<T>>(ok => {
      const onResponse = (event: Event) => {
        const response = (event as CustomEvent<RpcResponseInit<T>>).detail

        if (response.id !== request.id)
          return
        ok(RpcResponse.from(response))
      }

      events.addEventListener("response", onResponse)
    })
  }

  let balanceBigInt = 0n

  const net_tip = async () => {
    const {
      chainIdString,
      contractZeroHex,
      receiverZeroHex,
      nonceZeroHex,
      minimumZeroHex
    } = await requestOrThrow<{
      chainIdString: string,
      contractZeroHex: string,
      receiverZeroHex: string,
      nonceZeroHex: string,
      minimumZeroHex: string
    }>({
      method: "net_get"
    }).then(r => r.unwrap())

    // const minimumBigInt = BigInt(minimumZeroHex)

    // if (minimumBigInt > (2n ** 20n))
    //   throw new Error("Minimum too high")

    const chainIdBase16 = Number(chainIdString).toString(16).padStart(64, "0")
    const chainIdMemory = base16_decode_mixed(chainIdBase16)

    const contractBase16 = contractZeroHex.slice(2).padStart(64, "0")
    const contractMemory = base16_decode_mixed(contractBase16)

    const receiverBase16 = receiverZeroHex.slice(2).padStart(64, "0")
    const receiverMemory = base16_decode_mixed(receiverBase16)

    const nonceBase16 = nonceZeroHex.slice(2).padStart(64, "0")
    const nonceMemory = base16_decode_mixed(nonceBase16)

    const mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory, nonceMemory)

    const minimumBase16 = minimumZeroHex.slice(2).padStart(64, "0")
    const minimumMemory = base16_decode_mixed(minimumBase16)

    const generatedStruct = mixinStruct.generate(minimumMemory)

    const secretMemory = generatedStruct.to_secret()
    const secretBase16 = base16_encode_lower(secretMemory)
    const secretZeroHex = `0x${secretBase16}`

    balanceBigInt += await requestOrThrow<string>({ method: "net_tip", params: [secretZeroHex] }).then(r => BigInt(r.unwrap()))
  }

  events.addEventListener("bytes", async (event) => {
    const bytes = (event as CustomEvent<Uint8Array>).detail

    balanceBigInt -= BigInt(bytes.length)

    while (balanceBigInt < 65536n)
      await net_tip()

    console.log(bytes)
  })

  const send = async (bytes: Uint8Array) => {
    balanceBigInt -= BigInt(bytes.length)

    while (balanceBigInt < 65536n)
      await net_tip()

    socket.send(bytes)
  }

  const tlsBase16 = "16030100a5010000a10303000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f000020cca8cca9c02fc030c02bc02cc013c009c014c00a009c009d002f0035c012000a010000580000001800160000136578616d706c652e756c666865696d2e6e6574000500050100000000000a000a0008001d001700180019000b00020100000d0012001004010403050105030601060302010203ff0100010000120000"
  const tlsMemory = base16_decode_mixed(tlsBase16)

  await send(tlsMemory.copyAndDispose())
}