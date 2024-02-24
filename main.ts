// deno-lint-ignore-file no-empty require-await
import * as Dotenv from "https://deno.land/std@0.217.0/dotenv/mod.ts";
import * as Io from "https://deno.land/std@0.217.0/io/mod.ts";
import { RpcErr, RpcError, RpcInvalidParamsError, RpcInvalidRequestError, RpcMethodNotFoundError, RpcOk, RpcRequestInit } from "npm:@hazae41/jsonrpc@1.0.5";
import { Memory, NetworkMixin, base16_decode_mixed, base16_encode_lower, initBundledOnce } from "npm:@hazae41/network-bundle@1.1.0";
import * as Ethers from "npm:ethers";
import Abi from "./token.abi.json" with { type: "json" };

await Dotenv.load({ export: true })

await initBundledOnce()

const chainIdString = Deno.env.get("CHAIN_ID")!
const contractZeroHex = Deno.env.get("CONTRACT_ZERO_HEX")!
const privateKeyZeroHex = Deno.env.get("PRIVATE_KEY_ZERO_HEX")!

const provider = new Ethers.JsonRpcProvider("https://gnosis-rpc.publicnode.com")
const wallet = new Ethers.Wallet(privateKeyZeroHex).connect(provider)
const contract = new Ethers.Contract(contractZeroHex, Abi, wallet)

const minimumBigInt = 2n ** 20n
const minimumBase16 = minimumBigInt.toString(16).padStart(64, "0")
const minimumZeroHex = `0x${minimumBase16}`

const chainIdNumber = Number(chainIdString)
const chainIdBase16 = chainIdNumber.toString(16).padStart(64, "0")
const chainIdMemory = base16_decode_mixed(chainIdBase16)

const contractBase16 = contractZeroHex.slice(2).padStart(64, "0")
const contractMemory = base16_decode_mixed(contractBase16)

const receiverZeroHex = wallet.address
const receiverBase16 = receiverZeroHex.slice(2).padStart(64, "0")
const receiverMemory = base16_decode_mixed(receiverBase16)

let nonceBytes = crypto.getRandomValues(new Uint8Array(32))
let nonceMemory = new Memory(nonceBytes)
let nonceBase16 = base16_encode_lower(nonceMemory)
let nonceZeroHex = `0x${nonceBase16}`

let allSecretZeroHexSet = new Set<string>()
let allSecretBalanceBigInt = 0n

let mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory, nonceMemory)

const balanceByUuid = new Map<string, bigint>()

async function onHttpRequest(request: Request) {
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
    const [balanceBigInt = 0n] = [balanceByUuid.get(session)]
    balanceByUuid.set(session, balanceBigInt - BigInt(bytes.length))

    if (balanceBigInt < 0n) {
      close()
      return
    }

    try {
      await Io.writeAll(tcp, bytes)
    } catch { }
  }

  const onBackward = (bytes: Uint8Array) => {
    const [balanceBigInt = 0n] = [balanceByUuid.get(session)]
    balanceByUuid.set(session, balanceBigInt - BigInt(bytes.length))

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
    const [secretZeroHexArray] = request.params as [string[]]

    if (secretZeroHexArray.length === 0)
      throw new RpcInvalidParamsError()
    if (secretZeroHexArray.length > 10)
      throw new RpcInvalidParamsError()

    const filteredSecretZeroHexArray = secretZeroHexArray.filter(x => !allSecretZeroHexSet.has(x))
    const filteredSecretsBase16 = filteredSecretZeroHexArray.reduce((p, x) => p + x.slice(2), ``)
    const filteredSecretsMemory = base16_decode_mixed(filteredSecretsBase16)

    const valueMemory = mixinStruct.verify_secrets(filteredSecretsMemory)
    const valueBase16 = base16_encode_lower(valueMemory)
    const valueZeroHex = `0x${valueBase16}`
    const valueBigInt = BigInt(valueZeroHex)

    if (valueBigInt < minimumBigInt)
      throw new RpcInvalidRequestError()

    for (const secretZeroHex of filteredSecretZeroHexArray)
      allSecretZeroHexSet.add(secretZeroHex)

    const [balanceBigInt = 0n] = [balanceByUuid.get(session)]
    balanceByUuid.set(session, balanceBigInt + valueBigInt)

    console.log(`Received ${valueBigInt.toString()} wei`)

    allSecretBalanceBigInt += valueBigInt

    if (allSecretZeroHexSet.size > 640) {
      console.log(`Claiming ${allSecretBalanceBigInt.toString()} wei`)

      contract.claim(nonceZeroHex, [...allSecretZeroHexSet]).catch(console.error)

      allSecretZeroHexSet = new Set<string>()
      allSecretBalanceBigInt = 0n

      nonceBytes = crypto.getRandomValues(new Uint8Array(32))
      nonceMemory = new Memory(nonceBytes)
      nonceBase16 = base16_encode_lower(nonceMemory)
      nonceZeroHex = `0x${nonceBase16}`

      mixinStruct = new NetworkMixin(chainIdMemory, contractMemory, receiverMemory, nonceMemory)
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

Deno.serve({ hostname: "0.0.0.0", port: 8080 }, onHttpRequest);