# Notarize PDF

A Svelte-based web application for notarizing PDF files on the Ethereum blockchain using MetaMask. 
Files are hashed using SHA256 and stored immutably on-chain for verification purposes.

## Features

- Connect to MetaMask wallet
- Support for both Ethereum Mainnet and Sepolia Testnet
- Drag-and-drop file upload interface
- SHA256 hash generation for uploaded files
- On-chain storage and verification of document hashes
- Transaction history and timestamp verification

## Prerequisites

- Modern web browser with MetaMask extension installed
- Node.js and npm for development
- Ethereum wallet with ETH for transaction fees

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd notarize-pdf
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

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
4. If the file hasn't been notarized before, the "Notarize" button will be enabled
5. Click "Notarize" to store the hash on the blockchain
6. Confirm the transaction in MetaMask
7. Wait for transaction confirmation

### Verifying a Document

1. Upload a previously notarized file
2. The application will automatically check if the hash exists on-chain
3. If verified, you'll see a confirmation with the original timestamp
4. If not found, the file can be notarized

## Smart Contract

The application interacts with a smart contract deployed at:
```
0x6f4BDa64922e1E45DBDd3403535127408125e6B8
```

### Contract Methods

- `store(bytes32 hash)`: Stores a document hash with timestamp
- `verify(address recipient, bytes32 hash)`: Returns timestamp if hash exists, 0 if not

## Technical Details

### Dependencies

- **Svelte**: Frontend framework
- **Viem**: Ethereum client library
- **MetaMask**: Web3 wallet browser extension

### File Processing

1. Files are read as ArrayBuffer using FileReader API
2. SHA256 hash is generated using Viem's built-in hashing function
3. Hash is stored on-chain as bytes32 type

### Network Support

- **Mainnet**: Chain ID `0x1`
- **Sepolia Testnet**: Chain ID `0xaa36a7`

## Security Considerations

- Files are processed locally in the browser
- Only SHA256 hashes are stored on-chain, not file contents
- MetaMask handles all private key operations

## Gas Costs

- Storing a new hash: ~21,000-50,000 gas
- Verifying existing hash: Free (read-only operation)

## Troubleshooting

### MetaMask Connection Issues

- Ensure MetaMask is installed and unlocked
- Check that you're on the correct network
- Try refreshing the page and reconnecting

### Network Switching Problems

- Manually add Sepolia testnet to MetaMask if not present
- Ensure you have testnet ETH for Sepolia transactions

### Transaction Failures

- Check wallet balance for sufficient ETH
- Increase gas limit if transactions are failing
- Wait for network congestion to decrease
