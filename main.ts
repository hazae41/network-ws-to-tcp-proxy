import * as Dotenv from "https://deno.land/std@0.217.0/dotenv/mod.ts";
import { serve } from "./mod.ts";

const envPath = new URL(import.meta.resolve("./.env.local")).pathname

const {
  PORT = Deno.env.get("PORT") || "8080",
  PRIVATE_KEY_ZERO_HEX = Deno.env.get("PRIVATE_KEY_ZERO_HEX"),
} = await Dotenv.load({ envPath, examplePath: null })

if (PRIVATE_KEY_ZERO_HEX == null)
  throw new Error("PRIVATE_KEY_ZERO_HEX is not set")

const port = Number(PORT)
const chainIdString = "100"
const contractZeroHex = "0x0a4d5EFEa910Ea5E39be428A3d57B80BFAbA52f4"
const privateKeyZeroHex = PRIVATE_KEY_ZERO_HEX

const { onHttpRequest } = await serve({ chainIdString, contractZeroHex, privateKeyZeroHex })

Deno.serve({ hostname: "0.0.0.0", port }, onHttpRequest)