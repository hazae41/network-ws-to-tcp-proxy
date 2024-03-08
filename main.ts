import * as Dotenv from "https://deno.land/std@0.217.0/dotenv/mod.ts";
import { main } from "./mod.ts";

const envPath = new URL(import.meta.resolve("./.env.local")).pathname

const {
  PORT = Deno.env.get("PORT") || "8080",
  CERT = Deno.env.get("CERT"),
  KEY = Deno.env.get("KEY"),
} = await Dotenv.load({ envPath, examplePath: null })

const port = Number(PORT)

const cert = CERT != null
  ? Deno.readTextFileSync(CERT)
  : undefined

const key = KEY != null
  ? Deno.readTextFileSync(KEY)
  : undefined

const { onHttpRequest } = await main()

Deno.serve({ hostname: "0.0.0.0", port, cert, key }, onHttpRequest)