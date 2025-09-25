<script>
    import 'fast-text-encoding';
    import { onMount } from "svelte";
    import { encodeFunctionData, decodeFunctionResult } from 'viem';

    const abi = [
        { inputs: [{ internalType: "bytes32", name: "hash", type: "bytes32" }], name: "store", outputs: [], stateMutability: "nonpayable", type: "function" },
        { inputs: [{ internalType: "address", name: "recipient", type: "address" }, { internalType: "bytes32", name: "hash", type: "bytes32" }], name: "verify", outputs: [{ internalType: "uint256", name: "", type: "uint256" }], stateMutability: "view", type: "function" }
    ];
    const contractAddress = "0x6f7982aaCF30Cf6825d333049DD53BeD2D3eBE5c";

    let account = $state(null);
    let isConnected = $state(false);
    let isTestnet = $state(false);
    let hash = $state(null);
    let status = $state("Choose network and connect MetaMask");
    let isDisabled = $state(true);
    let fileName = $state(null);

    async function hashFile(file) {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return '0x' + Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function updateNetworkState(chainId) {
        const normalizedChainId = typeof chainId === 'string' ? chainId.toLowerCase() : `0x${chainId.toString(16)}`;
        isTestnet = normalizedChainId === "0xaa36a7";
        return normalizedChainId;
    }

    function updateStatus() {
        if (account) {
            status = `Connected to ${account.slice(0, 6)}...${account.slice(-4)} on ${isTestnet ? 'Sepolia' : 'Mainnet'}`;
        }
    }

    onMount(async () => {
        if (!window.ethereum) {
            status = "MetaMask not detected. Please install MetaMask.";
            return;
        }

        window.ethereum.on('chainChanged', (chainId) => {
            updateNetworkState(chainId);
            updateStatus();
        });

        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                account = accounts[0];
                updateStatus();
            } else {
                disconnectWallet();
            }
        });

        try {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts.length > 0) {
                account = accounts[0];
                isConnected = true;
                const chainId = await window.ethereum.request({ method: "eth_chainId" });
                updateNetworkState(chainId);
                updateStatus();
            }
        } catch (error) {
            console.error("Error checking connection:", error);
        }
    });

    async function connectWallet() {
        try {
            await window.ethereum.request({ method: "eth_requestAccounts" });
            const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
            const desiredChainId = isTestnet ? "0xaa36a7" : "0x1";

            if (currentChainId.toLowerCase() !== desiredChainId.toLowerCase()) {
                try {
                    await window.ethereum.request({ 
                        method: "wallet_switchEthereumChain", 
                        params: [{ chainId: desiredChainId }] 
                    });
                } catch (switchError) {
                    if (switchError.code === 4902 && isTestnet) {
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
                    } else if (switchError.code === 4001) {
                        const actualChainId = await window.ethereum.request({ method: "eth_chainId" });
                        updateNetworkState(actualChainId);
                        status = "Connected but network switch cancelled";
                        const accounts = await window.ethereum.request({ method: "eth_accounts" });
                        account = accounts[0];
                        isConnected = true;
                        return;
                    }
                }
            }

            const finalChainId = await window.ethereum.request({ method: "eth_chainId" });
            updateNetworkState(finalChainId);
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            account = accounts[0];
            isConnected = true;
            updateStatus();
            
        } catch (error) {
            status = error.code === 4001 ? "Connection cancelled by user" : `Connection failed: ${error.message}`;
        }
    }

    async function disconnectWallet() {
        try {
            await window.ethereum.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }]
            });
        } catch {}
        
        if (window.ethereum) {
            window.ethereum.removeAllListeners('chainChanged');
            window.ethereum.removeAllListeners('accountsChanged');
        }
        
        account = null;
        isConnected = false;
        hash = null;
        fileName = null;
        isDisabled = true;
        status = "Choose network and connect MetaMask";
    }

    async function filesChange(fileList) {
        if (!isConnected) {
            status = "Please connect MetaMask first";
            return;
        }

        hash = await hashFile(fileList[0]);
        fileName = fileList[0].name;

        try {
            const data = encodeFunctionData({abi, functionName: "verify", args: [account, hash]});
            const result = await window.ethereum.request({method: 'eth_call',
                params: [{ to: contractAddress, data }, 'latest']
            });
            if (!result || result == "0x") {
               status = `Error: Missing contract?`;
               isDisabled = false;
               hash = null
               fileName = null
               return;
            }
            const timestamp = decodeFunctionResult({abi, functionName: "verify", data: result});

            if (timestamp.toString() === "0") {
                isDisabled = false;
                status = `Not yet stored from account: ${account}`;
            } else {
                isDisabled = true;
                status = `<b>VERIFIED</b> in the blockchain! Timestamp: ${timestamp.toString()}`;
            }
        } catch (error) {
            isDisabled = false;
            hash = null
            fileName = null
            status = `Error: ${error.message}`;
        }
    }

    async function store() {
        try {
            const data = encodeFunctionData({abi, functionName: "store", args: [hash]});
            const txHash = await window.ethereum.request({method: 'eth_sendTransaction',
                params: [{ from: account, to: contractAddress, data }]
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

    <div class="dropbox" class:disabled={!isConnected}>
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

    .notarize-btn:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .dropbox {
        outline: 2px dashed grey;
        outline-offset: -10px;
        background: lightcyan;
        color: dimgray;
        min-height: 250px;
        position: relative;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        text-align: center;
        padding: 30px;
    }

    .dropbox.disabled {
        background: #f5f5f5;
        color: #ccc;
        cursor: not-allowed;
        outline-color: #ccc;
    }

    .dropbox:hover:not(.disabled) {
        background: lightblue;
    }

    .input-file {
        opacity: 0;
        position: absolute;
        inset: 0;
        cursor: pointer;
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