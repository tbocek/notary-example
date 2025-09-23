<script>
    import 'fast-text-encoding'; //polyfill
    import { onMount } from "svelte";
    import { encodeFunctionData, decodeFunctionResult } from 'viem';

    const abi = [
        { inputs: [{ internalType: "bytes32", name: "hash", type: "bytes32" }], name: "store", outputs: [], stateMutability: "nonpayable", type: "function" },
        { inputs: [{ internalType: "address", name: "recipient", type: "address" }, { internalType: "bytes32", name: "hash", type: "bytes32" }], name: "verify", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }
    ];
    const contractAddress = "0x6f4BDa64922e1E45DBDd3403535127408125e6B8";

    let account = $state(null);
    let isConnected = $state(false);
    let isTestnet = $state(false);
    let hash = $state(null);
    let status = $state("Choose network and connect MetaMask");
    let isDisabled = $state(true);
    let fileName = $state(null);

    // Web Crypto API for hashing
    async function hashFile(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return '0x' + Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    onMount(async () => {
        if (!window.ethereum) {
            status = "MetaMask not detected. Please install MetaMask.";
            return;
        }

        try {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts.length > 0) {
                account = accounts[0];
                isConnected = true;
                const chainId = await window.ethereum.request({ method: "eth_chainId" });
                isTestnet = chainId === "0xaa36a7";
                status = `Connected to ${account.slice(0, 6)}...${account.slice(-4)}`;
            }
        } catch (error) {
            console.error("Error checking connection:", error);
        }
    });

    async function connectWallet() {
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });

            // Switch to desired network
            const chainId = isTestnet ? "0xaa36a7" : "0x1";
            try {
                await window.ethereum.request({ 
                    method: "wallet_switchEthereumChain", 
                    params: [{ chainId }] 
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    if (isTestnet) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: '0xaa36a7',
                                chainName: 'Sepolia',
                                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                                rpcUrls: ['https://rpc.sepolia.org'],
                                blockExplorerUrls: ['https://sepolia.etherscan.io']
                            }]
                        });
                    }
                } else if (switchError.code === 4001) {
                    status = "Connected but network switch cancelled";
                    return;
                }
            }

            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            account = accounts[0];
            isConnected = true;
            status = `Connected to ${account.slice(0, 6)}...${account.slice(-4)}`;
        } catch (error) {
            status = error.code === 4001 ? "Connection cancelled by user" : `Connection failed: ${error.message}`;
        }
    }

    async function disconnectWallet() {
        account = null;
        isConnected = false;
        hash = null;
        fileName = null;
        isDisabled = true;
        status = "Disconnected";
    }

    async function filesChange(fileList) {
        if (!isConnected) {
            status = "Please connect MetaMask first";
            return;
        }

        hash = await hashFile(fileList[0]);
        fileName = fileList[0].name;

        try {
            // Encode function call using minimal viem
            const data = encodeFunctionData({
                abi,
                functionName: "verify",
                args: [account, hash]
            });
            
            // Direct RPC call
            const result = await window.ethereum.request({
                method: 'eth_call',
                params: [{
                    to: contractAddress,
                    data: data
                }, 'latest']
            });

            // Decode result using minimal viem
            const [timestamp] = decodeFunctionResult({
                abi,
                functionName: "verify",
                data: result
            });

            if (timestamp.toString() === "0") {
                isDisabled = false;
                status = `Not yet stored from account: ${account}`;
            } else {
                isDisabled = true;
                status = `<b>VERIFIED</b> in the blockchain! Timestamp: ${timestamp.toString()}`;
            }
        } catch (error) {
            isDisabled = false;
            status = `Error: ${error.message}`;
        }
    }

    async function store() {
        try {
            // Encode function call
            const data = encodeFunctionData({
                abi,
                functionName: "store",
                args: [hash]
            });
            
            // Send transaction via MetaMask
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: account,
                    to: contractAddress,
                    data: data
                }]
            });
            
            status = `Stored, tx is: ${txHash}`;
        } catch (error) {
            status = `Error: ${error.message}`;
        }
        isDisabled = true;
    }
</script>

<div>
    <div class="header">
        <h1>Notarize PDF</h1>
        <div class="wallet-connection">
            <div class="wallet-section">
                <div class="network-info">
                    {#if !isConnected}
                        <label class="network-checkbox">
                            <input type="checkbox" bind:checked={isTestnet} />
                            Use Testnet (Sepolia)
                        </label>
                    {:else}
                        {isTestnet ? "Sepolia Testnet" : "Ethereum Mainnet"}
                    {/if}
                </div>
                {#if !isConnected}
                    <button onclick={connectWallet} class="connect-btn">Connect MetaMask</button>
                {:else}
                    <button onclick={disconnectWallet} class="connect-btn disconnect">Disconnect</button>
                {/if}
            </div>
        </div>
    </div>

    <div class="dropbox" class:disabled={!isConnected}>
        <div class="dropbox-content">
            <input type="file" onchange={(e) => filesChange(e.target.files)} class="input-file" disabled={!isConnected} />
            {#if isConnected}
                Drag your file(s) here to begin<br /> or click to browse<br />
            {:else}
                Connect MetaMask to upload files<br />
            {/if}
            {#if hash !== null}
                <div>SHA256 Hash: <b>{hash}</b></div>
            {/if}
            {#if fileName !== null}
                <div>Name: <b>{fileName}</b></div>
            {/if}
        </div>
    </div>
    
    <button onclick={store} disabled={isDisabled || !isConnected} class="notarize-btn">Notarize</button>
    
    <div class="status-box">
        <span>{@html status.replace(/\n/g, '<br>')}</span>
    </div>
</div>

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }

    .header h1 {
        margin: 0;
    }

    .wallet-connection {
        padding: 15px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background: #f9f9f9;
        width: 250px;
    }

    .wallet-section {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .network-info {
        font-weight: 500;
        font-size: 14px;
        color: #333;
        min-height: 24px;
    }

    .network-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }

    .network-checkbox input[type="checkbox"] {
        transform: scale(1.2);
    }

    .connect-btn, .notarize-btn {
        background: #f6851b;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
    }

    .connect-btn:hover, .notarize-btn:hover:not(:disabled) {
        background: #e2761b;
    }

    .connect-btn.disconnect {
        background: #6c757d;
    }

    .connect-btn.disconnect:hover {
        background: #545b62;
    }

    .notarize-btn {
        margin-bottom: 15px;
    }

    .notarize-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .dropbox {
        outline: 2px dashed grey;
        outline-offset: -10px;
        background: lightcyan;
        color: dimgray;
        min-height: 200px;
        position: relative;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
    }

    .dropbox.disabled {
        background: #f5f5f5;
        color: #ccc;
        cursor: not-allowed;
        outline-color: #ccc;
    }

    .dropbox-content {
        text-align: center;
        padding: 20px;
    }

    .input-file {
        opacity: 0;
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        cursor: pointer;
    }

    .dropbox:hover:not(.disabled) {
        background: lightblue;
    }

    .status-box {
        padding: 12px 20px;
        border: 1px solid #ddd;
        border-radius: 5px;
        background: #f9f9f9;
        font-size: 14px;
        color: #333;
        font-weight: 500;
    }
</style>