
const net = require("net");
const dns = require("dns").promises;
const readline = require("readline");

const COMMON_PORTS = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    80: "HTTP",
    110: "POP3",
    135: "MS RPC",
    139: "NetBIOS",
    143: "IMAP",
    443: "HTTPS",
    445: "SMB",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    8000: "Development HTTP",
    8080: "HTTP Alternate"
};

function checkPort(host, port, timeout = 700) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let finished = false;

        function finish(isOpen) {
            if (finished) return;
            finished = true;
            socket.destroy();
            resolve(isOpen);
        }

        socket.setTimeout(timeout);

        socket.once("connect", () => finish(true));
        socket.once("timeout", () => finish(false));
        socket.once("error", () => finish(false));

        socket.connect(port, host);
    });
}

async function scanHost(host, startPort, endPort) {
    console.log("\n======================================");
    console.log("       LOCAL NETWORK PORT SCANNER");
    console.log("======================================");
    console.log(`Target: ${host}`);
    console.log(`Port range: ${startPort}-${endPort}`);
    console.log("--------------------------------------\n");

    let targetIP;

    try {
        const result = await dns.lookup(host);
        targetIP = result.address;
        console.log(`Resolved address: ${targetIP}\n`);
    } catch (error) {
        console.log("Error: Hostname could not be resolved.");
        console.log(`Details: ${error.message}`);
        return;
    }

    const openPorts = [];

    for (let port = startPort; port <= endPort; port++) {
        const isOpen = await checkPort(targetIP, port);

        if (isOpen) {
            const service = COMMON_PORTS[port] || "Unknown service";
            openPorts.push({ port, service });

            console.log(`[OPEN] ${port} - ${service}`);
        }
    }

    console.log("\n--------------------------------------");

    if (openPorts.length === 0) {
        console.log("No open TCP ports detected in this range.");
    } else {
        console.log(`Scan complete. Open ports: ${openPorts.length}`);

        for (const item of openPorts) {
            console.log(`Port ${item.port}: ${item.service}`);
        }
    }

    console.log("\nSECURITY SUMMARY");
    console.log("Open ports may expose services to other systems.");
    console.log("Disable unnecessary services and restrict access");
    console.log("with firewalls. Keep necessary services updated.");
    console.log("\nNote: Unresponsive ports may be closed or filtered.");
    console.log("Service names are typical port associations only.");
    console.log("======================================\n");
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
    try {
        console.log("Educational TCP Port Scanner");
        console.log("Use only on systems you own or are authorized to test.\n");

        const host = (await ask(
            "Enter target IP/hostname (default 127.0.0.1): "
        )).trim() || "127.0.0.1";

        const startInput = (await ask(
            "Enter starting port (default 1): "
        )).trim();

        const endInput = (await ask(
            "Enter ending port (default 1024): "
        )).trim();

        const startPort = startInput === "" ? 1 : Number(startInput);
        const endPort = endInput === "" ? 1024 : Number(endInput);

        if (
            !Number.isInteger(startPort) ||
            !Number.isInteger(endPort) ||
            startPort < 1 ||
            endPort > 65535 ||
            startPort > endPort
        ) {
            console.log("Invalid port range. Use ports 1-65535.");
            return;
        }

        if (endPort - startPort > 4999) {
            console.log("Please scan at most 5000 ports per run.");
            return;
        }

        await scanHost(host, startPort, endPort);
    } catch (error) {
        console.log(`Unexpected error: ${error.message}`);
    } finally {
        rl.close();
    }
}

main();
