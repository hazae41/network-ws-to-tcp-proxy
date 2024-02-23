// deno-lint-ignore-file no-empty require-await
import * as Dotenv from "https://deno.land/std@0.217.0/dotenv/mod.ts";
import * as Io from "https://deno.land/std@0.217.0/io/mod.ts";
import Postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js";
import { RpcErr, RpcError, RpcInvalidParamsError, RpcInvalidRequestError, RpcMethodNotFoundError, RpcOk, RpcRequestInit } from "npm:@hazae41/jsonrpc@1.0.5";
import { NetworkMixin, base16_decode_mixed, base16_encode_lower, initBundledOnce } from "npm:@hazae41/network-bundle@1.0.1";

await Dotenv.load({ export: true })

await initBundledOnce()

const sql = Postgres(Deno.env.get("DATABASE_URL")!, { ssl: "allow", types: { bigint: Postgres.BigInt }, onnotice: () => { } })

await sql`CREATE TABLE IF NOT EXISTS "secrets" ("secret" TEXT PRIMARY KEY, "claimed" BOOLEAN NOT NULL DEFAULT FALSE);`

let [{ count }] = await sql`SELECT COUNT(*) FROM "secrets" WHERE "claimed" = false;`

const chainIdString = Deno.env.get("CHAIN_ID")!
const contractZeroHex = Deno.env.get("CONTRACT_ZERO_HEX")!
const receiverZeroHex = Deno.env.get("RECEIVER_ZERO_HEX")!

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
    let balanceBigInt = balanceByUuid.get(session) || 0n
    balanceBigInt -= BigInt(bytes.length)
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
    let balanceBigInt = balanceByUuid.get(session) || 0n
    balanceBigInt -= BigInt(bytes.length)
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
    const request = JSON.parse(message) as RpcRequestInit

    try {
      socket.send(JSON.stringify(await onRequest(request)))
    } catch { }
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
    return { chainIdString, contractZeroHex, receiverZeroHex }
  }

  const onNetTip = async (request: RpcRequestInit) => {
    const [secretZeroHexArray] = request.params as [string[]]

    if (secretZeroHexArray.length === 0)
      throw new RpcInvalidParamsError()
    if (secretZeroHexArray.length > 10)
      throw new RpcInvalidParamsError()

    const conn = await sql.reserve()

    try {
      const known = await conn`SELECT * FROM "secrets" WHERE "secret" IN ${conn(secretZeroHexArray)};`

      const filteredSecretZeroHexArray = secretZeroHexArray.filter(x => !known.some(y => y.secret === x))
      const filteredSecretsBase16 = filteredSecretZeroHexArray.reduce((p, x) => p + x.slice(2), ``)
      const filteredSecretsMemory = base16_decode_mixed(filteredSecretsBase16)

      const totalMemory = mixinStruct.verify_secrets(filteredSecretsMemory)
      const totalBase16 = base16_encode_lower(totalMemory)
      const totalZeroHex = `0x${totalBase16}`
      const totalBigInt = BigInt(totalZeroHex)

      if (totalBigInt < 65536n)
        throw new RpcInvalidRequestError()

      await conn`INSERT INTO "secrets" ${conn(filteredSecretZeroHexArray.map(secret => ({ secret })))};`

      count += BigInt(filteredSecretZeroHexArray.length)

      let balanceBigInt = balanceByUuid.get(session) || 0n
      balanceBigInt += totalBigInt
      balanceByUuid.set(session, balanceBigInt)

      console.log(`Received ${totalBigInt.toString()} wei`)

      if (count < 1000n)
        return totalBigInt.toString()

      const batch = await conn`UPDATE "secrets" SET "claimed" = true WHERE "secret" IN (SELECT "secret" FROM "secrets" WHERE "claimed" = false LIMIT 659) RETURNING *;`
      console.log(JSON.stringify(batch.map(x => x.secret)).replaceAll(`"`, ``))
      count -= BigInt(batch.length)

      return totalBigInt.toString()
    } catch (e: unknown) {
      console.log(e)
      throw e
    } finally {
      conn.release()
    }
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