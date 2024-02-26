# WebSocket-to-TCP

Free WebSocket-to-TCP proxy using [Network](https://github.com/stars/hazae41/lists/network)

You can find public proxies here https://ws-to-tcp-list.hazae41.me/

## Getting started

### Hosting

You can easily deploy a node to cloud hosting such as [render.com](https://render.com) as a web service using Docker

Fork this repository on your GitHub account and select it on your cloud hosting platform

<img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/57eb5e56-7475-4bbf-9ba0-548f1444d6ff" width="500" />

### Environment variables

Setup environment variables

<img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/19c3c3a4-7833-4bf5-bd6c-3dac1e7f6e49" width="500" />

You can also create a `.env` file if you're self-hosting

#### `PRIVATE_KEY_ZERO_HEX` (required)

Your Ethereum private key as a 0x-prefixed base16 string

e.g. `0x35609a4c7e0334d76e15d107c52ee4e9beab1199556cef78fd8624351c0e2c8c`

#### `CONTRACT_ZERO_HEX` (optional)

The contract address as a 0x-prefixed base16 string

e.g. `0xF1eC047cbd662607BBDE9Badd572cf0A23E1130B`

#### `CHAIN_ID` (optional)

The chain ID as a number or as a 0x-prefixed base16 string

e.g. `100` or `0x64`

### Registering

You can register your proxy so it can be used by applications and services

Your node should 
- be publicly accessible via HTTPS (this should be the case if you used a cloud hosting)
- respond with correct access-control headers (this should be the case if you used a cloud hosting)
- have a correct uptime (this should be the case if you pay for it)

> You should also setup a DNS to point to your node if you can, to prevent the registry from being full of dead addresses
> 
> <img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/16a8748c-32c2-4eae-beda-64101531e2ab" width="500" />

You can test the connection to your node by running the following code in the DevTools console of a non-CSP-protected page (e.g. the new tab page on Chrome)

```tsx
new WebSocket("wss://HOSTNAME[:PORT]")
```

> Replace HOSTNAME by the domain name (or IP address) of your node (e.g. `myproxy.mywebsite.com`)
> 
> And PORT is only required if your node is on another port than 443 (the HTTPS port)
> 
> For example, if your node is on a cloud hosting, the port should be 443, so you need to do
>
> ```tsx
> new WebSocket("wss://myproxy.mywebsite.com")
> ```
>
> If you self-host your node on port 12345, you need to do
> 
> ```tsx
> new WebSocket("wss://myproxy.mywebsite.com:12345")
> ```

If you see no error, then you can register your node by calling `register` with `HOSTNAME[:PORT]`

https://gnosisscan.io/address/0x23Ece04aF67cC4c484f3A4b136A6F97b76A12Ebe#writeContract

<img src="https://github.com/hazae41/network-ws-to-tcp-proxy/assets/4405263/6296cb76-3dc8-4b58-a6a0-7ab620f1ec99" width="500" />

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
  params: [string[]]
}
```

Params contains the list of Network secrets as 0x-prefixed base16 strings of length 64

e.g.

```tsx
[
  "0xe353e28d6b6a21a8188ef68643e4b93d41bca5baa853965a6a0c9ab7427138b0",
  "0xe4a66606a16f0ec836570e9450f6ca5b1178418d326644d4f961b742f929ac92",
  "0xe9f98c34b1e0f065584b58677d3217a91964823324f787742663e6cd05396fa1",
  "0xedb0fff61d454abc85cf73de1d81ff2b4871900c95b14358b6db2b468a887f37",
  "0xf1110e2b673a5840df3be8bffb5069b112c331fc7607aa8f92c80838ffcb40b5",
  "0xf19746763e166c9ab79e212d84034b6b82702d75c91ff3e35568c5258f2282b3",
  "0xf1cb66451b5979e35489242e0cc8690b2a8b0e0df54ada3db3d90ecadbff39de",
  "0xf4abc45b9965d2f99f2a23f2caaaf70ba52e81f525188468a8501c79ac73f8b6",
  "0xf7b61b995ee315720b6d64110098e6da84a70af0649f400ee4ea9f655b00e06c",
  "0xff874cacad0cdde5a675b712d7d7fe230774d2e555e73989d601a879db384ab9"
]
```

**Each payment MUST contains at maximum 10 secrets with a minimum total value of `2 ** 20` wei**

It will return the amount added to your balance as a decimal bigint string

```tsx
{
  jsonrpc: "2.0",
  id: 123,
  result: "123456789123456789"
}
```
