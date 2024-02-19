# Example Network WebSocket-to-TCP proxy

## Deploying on DigitalOcean

- Fork this repository on your GitHub account
- Set `const receiverZeroHex = ` to your Ethereum address
- Host it as a DigitalOcean App

### Setup


<img src="https://github.com/hazae41/example-network-websocket-proxy/assets/4405263/c219b5e4-fcaf-4a96-80aa-40faeab1594c" width="500" />

### Billing (only $5/month)

<img src="https://github.com/hazae41/example-network-websocket-proxy/assets/4405263/347adfa0-5151-49c7-ae82-91065f8073d0" width="500" />

### Logs

<img src="https://github.com/hazae41/example-network-websocket-proxy/assets/4405263/5feb8827-43c5-4db9-b727-1e510feda843" width="500" />

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

#### net_pay
```tsx
{
  jsonrpc: "2.0",
  id: 123,
  method: "net_pay",
  params: [string[]]
}
```

Params contains the list of Network secrets as raw unprefixed base16 string of length 64

e.g.

```tsx
[
  "e353e28d6b6a21a8188ef68643e4b93d41bca5baa853965a6a0c9ab7427138b0",
  "e4a66606a16f0ec836570e9450f6ca5b1178418d326644d4f961b742f929ac92",
  "e9f98c34b1e0f065584b58677d3217a91964823324f787742663e6cd05396fa1",
  "edb0fff61d454abc85cf73de1d81ff2b4871900c95b14358b6db2b468a887f37",
  "f1110e2b673a5840df3be8bffb5069b112c331fc7607aa8f92c80838ffcb40b5",
  "f19746763e166c9ab79e212d84034b6b82702d75c91ff3e35568c5258f2282b3",
  "f1cb66451b5979e35489242e0cc8690b2a8b0e0df54ada3db3d90ecadbff39de",
  "f4abc45b9965d2f99f2a23f2caaaf70ba52e81f525188468a8501c79ac73f8b6",
  "f7b61b995ee315720b6d64110098e6da84a70af0649f400ee4ea9f655b00e06c",
  "ff874cacad0cdde5a675b712d7d7fe230774d2e555e73989d601a879db384ab9"
]
```

**Each payment MUST contains at maximum 10 secrets with a minimum total value of 16384 wei (2 ^ 14)**

It will return your new balance as a decimal bigint string

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  result: "123456789123456789"
}
```
