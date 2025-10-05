<script>
    import "fast-text-encoding";
    import { onMount } from "svelte";
    import { encodeFunctionData, decodeFunctionResult } from "viem";
    import { getUserOperationHash } from "viem/account-abstraction";

    const abi = [
        {
            inputs: [
                { internalType: "bytes32", name: "hash", type: "bytes32" },
            ],
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
    const entrypointAddress = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

    const smartAccountAbi = [
        {
            name: "execute",
            type: "function",
            inputs: [
                { type: "address", name: "dest" },
                { type: "uint256", name: "value" },
                { type: "bytes", name: "func" },
            ],
        },
        {
            name: "nonce",
            type: "function",
            inputs: [],
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
        },
    ];

    let account = $state(null);
    let isConnected = $state(false);
    let isTestnet = $state(false);
    let hash = $state(null);
    let status = $state("Choose network and connect MetaMask");
    let isDisabled = $state(true);
    let fileName = $state(null);
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

    function updateNetworkState(chainId) {
        const normalizedChainId =
            typeof chainId === "string"
                ? chainId.toLowerCase()
                : `0x${chainId.toString(16)}`;
        isTestnet = normalizedChainId === "0xaa36a7";
        return normalizedChainId;
    }

    function updateStatus() {
        if (account) {
            status = `Connected to ${account.slice(0, 6)}...${account.slice(-4)} on ${isTestnet ? "Sepolia" : "Mainnet"}`;
        }
    }

    onMount(async () => {
        if (!window.ethereum) {
            status = "MetaMask not detected. Please install MetaMask.";
            return;
        }

        window.ethereum.on("chainChanged", (chainId) => {
            updateNetworkState(chainId);
            updateStatus();
        });

        window.ethereum.on("accountsChanged", (accounts) => {
            if (accounts.length > 0) {
                account = accounts[0];
                updateStatus();
            } else {
                disconnectWallet();
            }
        });

        try {
            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });
            if (accounts.length > 0) {
                account = accounts[0];
                isConnected = true;
                const chainId = await window.ethereum.request({
                    method: "eth_chainId",
                });
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
            const currentChainId = await window.ethereum.request({
                method: "eth_chainId",
            });
            const desiredChainId = isTestnet ? "0xaa36a7" : "0x1";

            if (currentChainId.toLowerCase() !== desiredChainId.toLowerCase()) {
                try {
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: desiredChainId }],
                    });
                } catch (switchError) {
                    if (switchError.code === 4902 && isTestnet) {
                        await window.ethereum.request({
                            method: "wallet_addEthereumChain",
                            params: [
                                {
                                    chainId: "0xaa36a7",
                                    chainName: "Sepolia",
                                    nativeCurrency: {
                                        name: "ETH",
                                        symbol: "ETH",
                                        decimals: 18,
                                    },
                                    rpcUrls: ["https://rpc.sepolia.org"],
                                    blockExplorerUrls: [
                                        "https://sepolia.etherscan.io",
                                    ],
                                },
                            ],
                        });
                    } else if (switchError.code === 4001) {
                        const actualChainId = await window.ethereum.request({
                            method: "eth_chainId",
                        });
                        updateNetworkState(actualChainId);
                        status = "Connected but network switch cancelled";
                        const accounts = await window.ethereum.request({
                            method: "eth_accounts",
                        });
                        account = accounts[0];
                        isConnected = true;
                        return;
                    }
                }
            }

            const finalChainId = await window.ethereum.request({
                method: "eth_chainId",
            });
            updateNetworkState(finalChainId);
            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });
            account = accounts[0];
            isConnected = true;
            updateStatus();
        } catch (error) {
            status =
                error.code === 4001
                    ? "Connection cancelled by user"
                    : `Connection failed: ${error.message}`;
        }
    }

    async function disconnectWallet() {
        try {
            await window.ethereum.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }],
            });
        } catch {}

        if (window.ethereum) {
            window.ethereum.removeAllListeners("chainChanged");
            window.ethereum.removeAllListeners("accountsChanged");
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
            let addr = account;
            if (smartAccountAddress && smartAccountAddress !== "") {
                addr = smartAccountAddress;
            }
            const data = encodeFunctionData({
                abi,
                functionName: "verify",
                args: [addr, hash],
            });
            const result = await window.ethereum.request({
                method: "eth_call",
                params: [{ to: contractAddress, data }, "latest"],
            });
            if (!result || result == "0x") {
                status = `Error: Missing contract?`;
                isDisabled = false;
                hash = null;
                fileName = null;
                return;
            }
            const timestamp = decodeFunctionResult({
                abi,
                functionName: "verify",
                data: result,
            });

            if (timestamp.toString() === "0") {
                isDisabled = false;
                status = `Not yet stored from account: ${addr}`;
            } else {
                isDisabled = true;
                status = `<b>VERIFIED</b> in the blockchain! Timestamp: ${timestamp.toString()}`;
            }
        } catch (error) {
            isDisabled = false;
            hash = null;
            fileName = null;
            status = `Error: ${error.message}`;
        }
    }

    async function store() {
        if (smartAccountAddress && smartAccountAddress !== "") {
            try {
                // Check if smart account has ETH for gas fees
                const balance = await window.ethereum.request({
                    method: "eth_getBalance",
                    params: [smartAccountAddress, "latest"],
                });
                const balanceInWei = BigInt(balance);
                if (balanceInWei === 0n) {
                    status = `Error: Smart account ${smartAccountAddress} has no funds`;
                    isDisabled = true;
                    return;
                }

                // Get current nonce from smart account contract
                const nonceData = encodeFunctionData({
                    abi: smartAccountAbi,
                    functionName: "nonce",
                    args: [],
                });
                const nonceResult = await window.ethereum.request({
                    method: "eth_call",
                    params: [
                        { to: smartAccountAddress, data: nonceData },
                        "latest",
                    ],
                });
                const nonce = decodeFunctionResult({
                    abi: smartAccountAbi,
                    functionName: "nonce",
                    data: nonceResult,
                });

                // Build callData: smart account executes store(hash) on notarization contract
                const storeCallData = encodeFunctionData({
                    abi,
                    functionName: "store",
                    args: [hash],
                });
                const callData = encodeFunctionData({
                    abi: smartAccountAbi,
                    functionName: "execute",
                    args: [contractAddress, 0n, storeCallData],
                });

                // Get network gas prices
                const feeHistory = await window.ethereum.request({
                    method: "eth_feeHistory",
                    params: ["0x1", "latest", [50]],
                });
                const baseFee = BigInt(feeHistory.baseFeePerGas[0]);
                const priorityFee = BigInt(feeHistory.reward[0][0]);

                // Apply bundler minimums
                const minPriorityFee = 100000000n; // 0.1 gwei minimum for priority
                const minMaxFee = 100000025n; // bundler minimum for maxFee

                const actualPriorityFee =
                    priorityFee > minPriorityFee ? priorityFee : minPriorityFee;
                const actualMaxFee =
                    baseFee + actualPriorityFee > minMaxFee
                        ? baseFee + actualPriorityFee
                        : minMaxFee;

                const chainId = await window.ethereum.request({
                    method: "eth_chainId",
                });

                // Calculate UserOperation hash for signing (EIP-712 format for v0.7)
                const userOpHash = getUserOperationHash({
                    chainId: Number(chainId),
                    entryPointAddress: entrypointAddress,
                    entryPointVersion: "0.7",
                    userOperation: {
                        sender: smartAccountAddress,
                        nonce: BigInt(nonce),
                        callData: callData,
                        callGasLimit: BigInt("0x70000"),
                        verificationGasLimit: BigInt("0x20000"),
                        preVerificationGas: BigInt("0x10000"),
                        maxFeePerGas: BigInt(actualMaxFee),
                        maxPriorityFeePerGas: BigInt(actualPriorityFee),
                    },
                });

                // Sign the UserOperation hash with EOA
                const signature = await window.ethereum.request({
                    method: "personal_sign",
                    params: [userOpHash, account],
                });

                // Build final UserOperation with hex string values for bundler
                const userOp = {
                    sender: smartAccountAddress,
                    nonce: "0x" + nonce.toString(16),
                    callData: callData,
                    callGasLimit: "0x70000",
                    verificationGasLimit: "0x20000",
                    preVerificationGas: "0x10000",
                    maxFeePerGas: "0x" + actualMaxFee.toString(16),
                    maxPriorityFeePerGas: "0x" + actualPriorityFee.toString(16),
                    signature: signature,
                };

                // Send UserOperation to bundler
                //const bundlerUrl =
                //    "https://eth-sepolia.g.alchemy.com/v2/API-KEY";
                const bundlerUrl = 'https://public.pimlico.io/v2/11155111/rpc'
                const response = await fetch(bundlerUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "eth_sendUserOperation",
                        params: [userOp, entrypointAddress],
                    }),
                });

                const result = await response.json();

                if (result.error) {
                    status = `Bundler error: ${result.error.message}`;
                } else {
                    status = `UserOp submitted: ${result.result}`;
                }
                
            } catch (error) {
                status = `Error: ${error.message}`;
            }
            isDisabled = true;
            return;
        }

        try {
            const data = encodeFunctionData({
                abi,
                functionName: "store",
                args: [hash],
            });
            const txHash = await window.ethereum.request({
                method: "eth_sendTransaction",
                params: [{ from: account, to: contractAddress, data }],
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
                <button onclick={connectWallet} class="connect-btn"
                    >Connect MetaMask</button
                >
            {:else}
                <button
                    onclick={disconnectWallet}
                    class="connect-btn disconnect">Disconnect</button
                >
                <label class="smart-account-label">
                    Smart Account Address:
                    <input
                        type="text"
                        bind:value={smartAccountAddress}
                        placeholder="0x..."
                        class="smart-account-input"
                    />
                </label>
            {/if}
        </div>
    </div>

    <div class="dropbox" class:disabled={!isConnected}>
        <input
            type="file"
            onchange={(e) => filesChange(e.target.files)}
            class="input-file"
            disabled={!isConnected}
        />
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

    <button
        onclick={store}
        disabled={isDisabled || !isConnected}
        class="notarize-btn">Notarize</button
    >

    <div class="status-box">
        <span>{@html status.replace(/\n/g, "<br>")}</span>
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

    .connect-btn,
    .notarize-btn {
        background: #f6851b;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
    }

    .connect-btn:hover,
    .notarize-btn:hover:not(:disabled) {
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
