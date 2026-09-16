import { createWalletClient, custom, publicActions, parseAbi, sha256 } from "https://esm.sh/viem@2.56.5";
import { sepolia } from "https://esm.sh/viem@2.56.5/chains";

const contractAddress = "0x6f7982aaCF30Cf6825d333049DD53BeD2D3eBE5c";
const abi = parseAbi([
    "function store(bytes32 hash)",
    "function verify(address recipient, bytes32 hash) view returns (uint256)",
]);

const el = Object.fromEntries(
    [...document.querySelectorAll("[id]")].map((e) => [e.id.replace(/-(\w)/g, (_, c) => c.toUpperCase()), e])
);

const ethereum = window.ethereum;
const client = ethereum && createWalletClient({ transport: custom(ethereum) }).extend(publicActions);

// State
let account = null;
let chainId = null;
let hash = null;
let fileName = null;
let isVerified = false;

const shortAddress = (a) => `${a.slice(0, 6)}...${a.slice(-4)}`;
const errorText = (e) => `Error: ${e.shortMessage ?? e.message}`;

function setStatus(message) {
    el.status.innerHTML = message;
}

function render() {
    const connected = account !== null;
    el.fileInput.disabled = !connected;
    el.dropboxText.textContent = connected
        ? "Drag your file here or click to browse"
        : "Connect MetaMask to upload files";

    el.fileInfo.hidden = hash === null;
    el.fileName.textContent = fileName ?? "";
    el.fileHash.textContent = hash ?? "";

    el.controlsDisconnected.hidden = connected;
    el.controlsConnected.hidden = !connected;
    el.notarizeBtn.disabled = !hash || !connected || isVerified || chainId !== sepolia.id;
}

function setConnected(acc, id) {
    account = acc;
    chainId = id;
    setStatus(
        id === sepolia.id
            ? `Connected to ${shortAddress(acc)} on ${sepolia.name}`
            : `Connected to ${shortAddress(acc)}, please switch MetaMask to ${sepolia.name}`
    );
    render();
}

function setDisconnected() {
    account = null;
    hash = null;
    fileName = null;
    isVerified = false;
    el.fileInput.value = "";
    setStatus("Connect MetaMask");
    render();
}

async function connect() {
    try {
        const [acc] = await client.requestAddresses();
        try {
            await client.switchChain({ id: sepolia.id });
        } catch (e) {
            if (e.code !== 4902) throw e;
            await client.addChain({ chain: sepolia });
        }
        setConnected(acc, await client.getChainId());
    } catch (e) {
        setStatus(e.code === 4001 ? "Connection cancelled by user" : errorText(e));
    }
}

async function disconnect() {
    try {
        await ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {}
    setDisconnected();
}

async function filesChange(files) {
    if (files.length === 0) return;
    hash = sha256(new Uint8Array(await files[0].arrayBuffer()));
    fileName = files[0].name;
    isVerified = false;
    render();

    try {
        const timestamp = await client.readContract({
            address: contractAddress,
            abi,
            functionName: "verify",
            args: [account, hash],
        });
        isVerified = timestamp !== 0n;
        setStatus(
            isVerified
                ? `🎉 <b>VERIFIED</b> in the blockchain! Timestamp: ${timestamp}`
                : `Not yet stored from account: ${account}`
        );
    } catch (e) {
        hash = null;
        fileName = null;
        setStatus(errorText(e));
    }
    render();
}

async function store() {
    try {
        const txHash = await client.writeContract({
            account,
            chain: sepolia,
            address: contractAddress,
            abi,
            functionName: "store",
            args: [hash],
        });
        isVerified = true;
        setStatus(`Stored, tx is: ${txHash}`);
    } catch (e) {
        setStatus(errorText(e));
    }
    render();
}

async function init() {
    if (!client) {
        setStatus("MetaMask not detected. Please install MetaMask.");
        return;
    }
    ethereum.on("chainChanged", (id) => account && setConnected(account, Number(id)));
    ethereum.on("accountsChanged", (accounts) =>
        accounts.length ? setConnected(accounts[0], chainId) : setDisconnected()
    );

    el.fileInput.addEventListener("change", (e) => filesChange(e.target.files));
    el.connectBtn.addEventListener("click", connect);
    el.notarizeBtn.addEventListener("click", store);
    el.disconnectBtn.addEventListener("click", disconnect);

    const [acc] = await client.getAddresses();
    if (acc) setConnected(acc, await client.getChainId());
}

render();
init();
