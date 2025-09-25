# Notarize PDF
A Svelte-based web application for notarizing files on the Ethereum blockchain using MetaMask. 
Files are hashed using SHA256 and stored immutably on-chain for verification purposes.

## Features
- Connect to MetaMask wallet
- Support for both Ethereum Mainnet and Sepolia Testnet
- Drag-and-drop file upload interface (supports any file type, not just PDFs)
- SHA256 hash generation for uploaded files
- On-chain storage and verification of document hashes per account
- Transaction confirmation and timestamp verification

## Prerequisites
- Modern web browser with MetaMask extension installed
- Node.js and pnpm for development
- Ethereum wallet with ETH for transaction fees

## Installation & Running

### Option 1: Docker Compose (Recommended)
```bash
docker-compose up --build
```

### Option 2: Docker
```bash
docker build . -t notary-example
docker run -p 3000:3000 -v ./src:/app/src notary-example
```

### Option 3: Local Development
```bash
pnpm install
pnpm run dev
```

Open your browser and navigate to `http://localhost:3000`

## Usage

### Connecting to MetaMask
1. Check "Use Testnet (Sepolia)" if you want to use the testnet
2. Click "Connect MetaMask"
3. Approve the connection in your MetaMask wallet
4. The application will automatically switch to your selected network

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
