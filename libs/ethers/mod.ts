export function warn(e: unknown) {
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