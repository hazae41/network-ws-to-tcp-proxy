# Network WebSocket-to-TCP proxy

Free WebSocket-to-TCP proxy using [Network](https://github.com/stars/hazae41/lists/network)

You can find public proxies here https://ws-to-tcp.hazae41.me/

## Getting started

### Hosting

#### Cloud-hosting

You can easily deploy it as a Dockerized web service to cloud-hosting providers such as [render.com](https://render.com).

Prices are ~$5 for the cheapest hosting. Do not use free tiers as they may have high downtimes.

Just fork this repository on your GitHub account and select it on your cloud hosting platform.

<img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/57eb5e56-7475-4bbf-9ba0-548f1444d6ff" width="500" />

Then setup environment variables (see list below)

<img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/19c3c3a4-7833-4bf5-bd6c-3dac1e7f6e49" width="500" />

#### Self-hosting

You just need 
- Docker (e.g. for [Ubuntu](https://docs.docker.com/engine/install/ubuntu/))
- Make (e.g. `sudo apt-get install make`)
- Git (e.g. `sudo apt-get install git`)

Then clone the repository (or fork-then-clone)

```bash
git clone https://github.com/hazae41/network-ws-to-tcp-proxy && cd ./network-ws-to-tcp-proxy
```

Setup environment variables (see list below) by creating a `.env.local` file

```bash
cp ./.env.example ./.env.local && nano ./.env.local
```

You can then: 

- Build the latest commit and latest environment variables

```bash
make build
```

- Start and open console (kill with ctrl+c; close with ctrl+p then ctrl+q)

```bash
make start
```

- Show logs

```bash
make logs
```

- Open console (kill with ctrl+c; close with ctrl+p then ctrl+q)

```bash
make open
```

- Stop all instances

```bash
make stop
```

- Clean all builds

```bash
make clean
```

- Update to latest version

```bash
git reset --hard && git checkout $(git tag | sort -V | tail -1) 
```

You can enable HTTPS by either using Cloudflare as a HTTPS-to-HTTP reverse proxy, by configuring Nginx as a HTTPS-to-HTTP reverse proxy on your node, or by setting `CERT` and `KEY`.

### Environment variables

#### `PORT` (default to 8080)

**Don't set if cloud-hosting**

The exposed port

e.g. `8080`

#### `CERT` and `KEY` (optional)

**Don't set if cloud-hosting**

The paths to your TLS certificate and private key

e.g. `./tls/fullchain.pem` and `./tls/privkey.pem`

#### `PRIVATE_KEY_ZERO_HEX` (required)

Your Ethereum private key as a 0x-prefixed base16 string.

This account must have some xDAI (gas on Gnosis chain).

e.g. `0x35609a4c7e0334d76e15d107c52ee4e9beab1199556cef78fd8624351c0e2c8c`

#### `SIGNALER_URL_LIST` (recommended)

A comma-separated list of signaler url in order to publish your node there and be on the market

This is usually a `wss:` url

e.g. `wss://signal.node0.hazae41.me`

#### `SIGNALED_URL` (recommended)

The public url for contacting your node over WebSocket

e.g. `wss://myrpc.example.com` or `wss://something.onrender.com`

## Protocol

Connect to the proxy via WebSocket with the following URL query parameters
- `session` -> A unique private random unguessable string for your session (e.g. `crypto.randomUUID()`)
- `hostname` -> TCP target hostname (e.g. `google.com`)
- `port` -> TCP target port (e.g. `80` for HTTP, `443` for HTTPS)

e.g. `ws://localhost:8000/?hostname=google.com&port=80&session=22deac58-7e01-4ddb-b9c4-07c73a32d1b5`

The connection then consists of two duplexes
- you send/receive bytes to talk with the TCP target
- you send/receive strings to talk with the proxy via JSON-RPC

### Price

The price is 1 wei = 1 byte of communication
- Your balance is withdrawn when you send bytes to the TCP target
- Your balance is withdrawn when the TCP target sends you bytes

**You MUST pay before talking with the TCP target**

All connections are closed when your balance is negative

So you must count how many bytes you sent/received and pay when your balance is low

### JSON-RPC

The proxy accepts the following JSON-RPC methods

#### net_get

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  method: "net_get"
}
```

Returns the Network parameters as `{ chainIdString, contractZeroHex, receiverZeroHex, nonceZeroHex, minimumZeroHex }`

#### net_tip

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  method: "net_tip",
  params: [string]
}
```

Params contains a Network secret as a 0x-prefixed base16 string of length 64

e.g.

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  method: "net_tip",
  params: ["0xe353e28d6b6a21a8188ef68643e4b93d41bca5baa853965a6a0c9ab7427138b0"]
}
```

It will return the value added to your balance as a decimal bigint string

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  result: "123456789123456789"
}
```
