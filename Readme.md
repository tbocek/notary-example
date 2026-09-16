# Notarize PDF

A plain JavaScript web application (no framework, no bundler) for notarizing files on the Ethereum blockchain using MetaMask.
Files are hashed using SHA256 and stored immutably on-chain for verification purposes.
[viem](https://viem.sh) is loaded directly in the browser from esm.sh (see `src/index.js`), so there is no build step and no npm dependencies: `src/` is served as static files.

## Features

- Connect to MetaMask wallet
- Runs on the Sepolia testnet
- Drag-and-drop file upload interface (supports any file type, not just PDFs)
- SHA256 hash generation for uploaded files
- On-chain storage and verification of document hashes per account
- Transaction confirmation and timestamp verification

## Prerequisites

- Modern web browser with MetaMask extension installed
- Any static file server (Docker Compose with Caddy is provided, or e.g. `python -m http.server`)
- Ethereum wallet with ETH for transaction fees

## Installation & Running

### Option 1: Docker Compose (Recommended)

```bash
docker compose up
```

or `./start.sh`

### Option 2: Local Development

```bash
python -m http.server 3000 -d src
```

Open your browser and navigate to `http://localhost:3000`

## Usage

### Connecting to MetaMask

1. Click "Connect MetaMask (Sepolia)"
2. Approve the connection in your MetaMask wallet
3. The application will automatically switch MetaMask to Sepolia

### Notarizing a Document

1. Ensure your MetaMask wallet is connected
2. Drag and drop a file onto the upload area, or click to browse
3. The application will generate a SHA256 hash of your file
4. The app checks if this hash has been stored by your current account
5. If not found, click "Notarize" to store the hash on the blockchain
6. Confirm the transaction in MetaMask
7. Wait for transaction confirmation

### Verifying a Document

1. Upload a file you want to verify
2. The application automatically checks if the hash exists on-chain for your account
3. If verified, you'll see confirmation with the original timestamp
4. If not found, the file can be notarized

**Important**: Verification is account-specific. A file notarized by one account won't show as verified when checked by a different account.

### Contract Methods

- `store(bytes32 hash)`: Stores a document hash with timestamp for msg.sender
- `verify(address recipient, bytes32 hash)`: Returns timestamp if hash exists for that address, 0 if not
