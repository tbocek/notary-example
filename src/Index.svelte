<script>
    import { onMount } from "svelte";
    import { createWalletConnection, callContractFunction, sendContractTx } from "./wallet.js";
    import { executeSmartAccountTransaction } from "./aa.js";
    import { setupStaticRoutes } from "preveltekit";

    const abi = [
        {
            inputs: [{ internalType: "bytes32", name: "hash", type: "bytes32" }],
            name: "store",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
        },
        {
            inputs: [
                { internalType: "address", name: "recipient", type: "address" },
                { internalType: "bytes32", name: "hash", type: "bytes32" },
            ],
            name: "verify",
            outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
            stateMutability: "view",
            type: "function",
        },
    ];
    const contractAddress = "0x6f7982aaCF30Cf6825d333049DD53BeD2D3eBE5c";

    let walletConnection;
    let account = $state(null);
    let isConnected = $state(false);
    let isTestnet = $state(false);
    let hash = $state(null);
    let status = $state("Choose network and connect MetaMask");
    let fileName = $state(null);
    let isVerified = $state(false);
    let isDisabled = $derived(!hash || !isConnected || isVerified);
    let smartAccountAddress = $state("");

    async function hashFile(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
        return (
            "0x" +
            Array.from(new Uint8Array(hashBuffer))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
        );
    }

    onMount(() => {
        walletConnection = createWalletConnection({
            onConnected: (acc, testnet, switchCancelled = false) => {
                account = acc;
                isConnected = true;
                isTestnet = testnet;
                status = switchCancelled
                    ? "Connected but network switch cancelled"
                    : `Connected to ${acc.slice(0, 6)}...${acc.slice(-4)} on ${testnet ? "Sepolia" : "Mainnet"}`;
            },
            onDisconnected: () => {
                account = null;
                isConnected = false;
                hash = null;
                fileName = null;
                isVerified = false;
                status = "Choose network and connect MetaMask";
            },
            onChainChanged: (testnet) => {
                isTestnet = testnet;
                if (account) {
                    status = `Connected to ${account.slice(0, 6)}...${account.slice(-4)} on ${testnet ? "Sepolia" : "Mainnet"}`;
                }
            },
            onAccountChanged: (acc) => {
                account = acc;
                if (acc) {
                    status = `Connected to ${acc.slice(0, 6)}...${acc.slice(-4)} on ${isTestnet ? "Sepolia" : "Mainnet"}`;
                }
            },
            onError: (message) => {
                status = message;
            },
        });

        walletConnection.initialize();
    });

    async function filesChange(fileList) {
        if (!isConnected) {
            status = "Please connect MetaMask first";
            return;
        }
    
        hash = await hashFile(fileList[0]);
        fileName = fileList[0].name;
        isVerified = false; // Reset verification state
    
        try {
            const addr = smartAccountAddress || account;
            const timestamp = await callContractFunction(walletConnection.wallet, contractAddress, abi, "verify", [addr, hash]);
    
            if (timestamp.toString() === "0") {
                status = `Not yet stored from account: ${addr}`;
            } else {
                isVerified = true;
                status = `<b>VERIFIED</b> in the blockchain! Timestamp: ${timestamp.toString()}`;
            }
        } catch (error) {
            hash = null;
            fileName = null;
            status = `Error: ${error.message}`;
        }
    }

    async function store() {
        try {
            if (smartAccountAddress) {
                const userOpHash = await executeSmartAccountTransaction(
                    walletConnection.wallet,
                    smartAccountAddress,
                    account,
                    contractAddress,
                    abi,
                    "store",
                    [hash]
                );
                status = `UserOp submitted: ${userOpHash}`;
            } else {
                const txHash = await sendContractTx(walletConnection.wallet, account, contractAddress, abi, "store", [hash]);
                status = `Stored, tx is: ${txHash}`;
            }
            isVerified = true;
        } catch (error) {
            status = `Error: ${error.message}`;
        }
    }

    const routes = {
        staticRoutes: [
            {
                path: "/",
                htmlFilename: "index.html",
            },
        ],
    };
    setupStaticRoutes(routes);
</script>

<div class="container">
    <h1>Notarize PDF</h1>

    <div class="dropbox" class:disabled={!isConnected}>
        <input type="file" onchange={(e) => filesChange(e.target.files)} class="input-file" disabled={!isConnected} />
        {#if isConnected}
            Drag your file here or click to browse
        {:else}
            Connect MetaMask to upload files
        {/if}
        {#if hash !== null}
            <div class="file-info">
                <div>
                    <strong>File:</strong>
                    {fileName}
                </div>
                <div>
                    <strong>SHA256:</strong>
                    {hash}
                </div>
            </div>
        {/if}
    </div>

    <div class="status-box">
        <span>{@html status.replace(/\n/g, "<br>")}</span>
    </div>

    <div class="controls">
        {#if !isConnected}
            <label class="network-toggle">
                <input type="checkbox" bind:checked={isTestnet} />
                <span>Use Testnet (Sepolia)</span>
            </label>
            <button onclick={() => walletConnection.connect(isTestnet)} class="btn btn-connect">
                Connect MetaMask
            </button>
        {:else}
            <label class="input-group">
                <span>Smart Account (optional):</span>
                <input type="text" bind:value={smartAccountAddress} placeholder="0x..." class="address-input" />
            </label>
            <button onclick={store} disabled={isDisabled} class="btn btn-primary">Notarize</button>
            <button onclick={() => walletConnection.disconnect()} class="btn btn-secondary">Disconnect</button>
        {/if}
    </div>
</div>

<style>
    .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
    }

    h1 {
        font-size: 28px;
        margin: 0 0 30px 0;
        color: #1a1a1a;
    }

    .dropbox {
        border: 2px dashed #ccc;
        border-radius: 8px;
        background: #fafafa;
        color: #666;
        min-height: 200px;
        position: relative;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        padding: 40px;
        text-align: center;
        transition: all 0.2s;
    }

    .dropbox:hover:not(.disabled) {
        border-color: #999;
        background: #f0f0f0;
    }

    .dropbox.disabled {
        background: #f5f5f5;
        color: #ccc;
        cursor: not-allowed;
        border-color: #e0e0e0;
    }

    .input-file {
        opacity: 0;
        position: absolute;
        inset: 0;
        cursor: pointer;
    }

    .file-info {
        margin-top: 20px;
        padding: 15px;
        background: white;
        border-radius: 6px;
        text-align: left;
        width: 100%;
        max-width: 600px;
        font-size: 13px;
        word-break: break-all;
    }

    .file-info div {
        margin: 5px 0;
    }

    .status-box {
        padding: 15px 20px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
        font-size: 14px;
        color: #333;
        min-height: 50px;
        margin-bottom: 30px;
    }

    .controls {
        display: flex;
        gap: 12px;
        align-items: flex-end;
        flex-wrap: wrap;
    }

    .network-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 14px;
        margin-right: auto;
    }

    .network-toggle input {
        cursor: pointer;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        flex: 1;
        min-width: 250px;
    }

    .input-group span {
        font-weight: 500;
        color: #555;
    }

    .address-input {
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
        font-family: monospace;
    }

    .btn {
        padding: 12px 24px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 500;
        transition: all 0.2s;
    }

    .btn-connect {
        background: #f6851b;
        color: white;
    }

    .btn-connect:hover {
        background: #e2761b;
    }

    .btn-primary {
        background: #f6851b;
        color: white;
    }

    .btn-primary:hover:not(:disabled) {
        background: #e2761b;
    }

    .btn-primary:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .btn-secondary {
        background: #6c757d;
        color: white;
    }

    .btn-secondary:hover {
        background: #545b62;
    }
</style>
