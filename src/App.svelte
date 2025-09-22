<script>

  if (typeof globalThis !== 'undefined') {
      if (!globalThis.TextEncoder) {
        globalThis.TextEncoder = class TextEncoder {
          encode(str) {
            return new Uint8Array([...str].map(c => c.charCodeAt(0)));
          }
        };
      }
      if (!globalThis.TextDecoder) {
        globalThis.TextDecoder = class TextDecoder {
          decode(bytes) {
            return String.fromCharCode(...bytes);
          }
        };
      }
    }

  import { onMount } from 'svelte';

  import { createPublicClient, createWalletClient, custom, http, sha256 } from 'viem';
  import { mainnet } from 'viem/chains';

  const abi = [
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "store",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "verify",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];
  const contractAddress = "0x6f4BDa64922e1E45DBDd3403535127408125e6B8";

  let publicClient;
  let walletClient;
  let account = $state(null);

  let hash = $state(null);
  let status = $state('nothing uploaded');
  let isDisabled = $state(true);
  let fileName = $state(null);
  let timestamp = $state(0);

  function stringHash(arrayBuffer) {
    return sha256(new Uint8Array(arrayBuffer));
  }

  onMount(() => {
    window.addEventListener('load', async () => {
      if (!window.ethereum) {
        status = 'No web3? You should consider trying MetaMask!';
      } else {
        publicClient = createPublicClient({
          chain: mainnet,
          transport: http()
        });

        walletClient = createWalletClient({
          chain: mainnet,
          transport: custom(window.ethereum)
        });

        [account] = await walletClient.getAddresses();
      }
    });
  });

  async function filesChange(fileList) {
    const fr = new FileReader();
    fr.onload = async (e) => {
      hash = stringHash(e.target.result);
      try {
        const result = await publicClient.readContract({
          address: contractAddress,
          abi: abi,
          functionName: 'verify',
          args: [account, hash]
        });

        if (result == 0) {
          isDisabled = false;
          timestamp = 0;
          status = 'not yet stored from account: ' + account;
        } else {
          isDisabled = true;
          status = '<b>VERIFIED</b> in the blockchain! Timestamp: ' + Number(result);
        }
      } catch (error) {
        timestamp = 0;
        isDisabled = false;
        status = 'error: ' + error;
      }
    };
    fr.readAsArrayBuffer(fileList[0]);
    fileName = fileList[0].name;
  }

  async function store() {
    try {
      const txHash = await walletClient.writeContract({
        account: account,
        address: contractAddress,
        abi: abi,
        functionName: 'store',
        args: [hash]
      });
      status = 'stored, tx is: ' + txHash;
    } catch (error) {
      status = 'error: ' + error;
    }
    timestamp = 0;
    isDisabled = true;
  }
</script>

<div>
  <h1>Notarize PDF</h1>
  <div class="dropbox">
    <input
      type="file"
      onchange={(e) => filesChange(e.target.files)}
      class="input-file"
    />
    Drag your file(s) here to begin<br> or click to browse<br>
    {#if hash !== null}
      <div>SHA256 Hash: <b>{hash}</b></div>
    {/if}
    {#if fileName !== null}
      <div>Name: <b>{fileName}</b></div>
    {/if}
    {#if timestamp !== 0}
      <div>
        <span id="check">&#10003;</span> VERIFIED at timestamp {timestamp}s with account {account}
      </div>
    {/if}
  </div>
  <button onclick={store} disabled={isDisabled}>Notarize</button>
  status: <span>{@html status}</span>
</div>

<style>
  .dropbox {
    outline: 2px dashed grey; /* the dash box */
    outline-offset: -10px;
    background: lightcyan;
    color: dimgray;
    padding: 10px 10px;
    min-height: 200px; /* minimum height */
    position: relative;
    cursor: pointer;
  }

  .input-file {
    opacity: 0; /* invisible but it's there! */
    width: 100%;
    height: 200px;
    position: absolute;
    cursor: pointer;
  }

  .dropbox:hover {
    background: lightblue; /* when mouse over to the drop zone, change color */
  }

  #check {
    content: "\2713";
    color: green;
    font-size: 2em;
  }
</style>
