
const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer));
    });
}

// Classical cipher: Caesar
function caesarCipher(text, shift) {
    shift = ((Number(shift) % 26) + 26) % 26;

    return text.replace(/[a-z]/gi, char => {
        const base = char >= "a" && char <= "z" ? 97 : 65;
        return String.fromCharCode(
            ((char.charCodeAt(0) - base + shift) % 26) + base
        );
    });
}

// Modern cipher: AES-256-GCM with password-based key derivation
function deriveKey(password, salt) {
    return crypto.scryptSync(password, salt, 32);
}

function aesEncrypt(text, password) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = deriveKey(password, salt);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        key,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(text, "utf8"),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    // Store everything required for decryption
    return JSON.stringify({
        algorithm: "AES-256-GCM",
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        ciphertext: encrypted.toString("base64")
    });
}

function aesDecrypt(encryptedData, password) {
    const data = JSON.parse(encryptedData);

    if (
        data.algorithm !== "AES-256-GCM" ||
        !data.salt ||
        !data.iv ||
        !data.authTag ||
        typeof data.ciphertext !== "string"
    ) {
        throw new Error("Invalid encrypted data format.");
    }

    const salt = Buffer.from(data.salt, "base64");
    const iv = Buffer.from(data.iv, "base64");
    const authTag = Buffer.from(data.authTag, "base64");
    const ciphertext = Buffer.from(data.ciphertext, "base64");

    if (salt.length !== 16 || iv.length !== 12 || authTag.length !== 16) {
        throw new Error("Invalid encrypted data.");
    }

    const key = deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    // A wrong password or altered ciphertext will fail authentication
    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString("utf8");
}

async function main() {
    console.log("\n==================================");
    console.log("   ENCRYPTION & DECRYPTION TOOLKIT");
    console.log("==================================");
    console.log("1. Caesar Cipher - Encrypt");
    console.log("2. Caesar Cipher - Decrypt");
    console.log("3. AES-256 - Encrypt");
    console.log("4. AES-256 - Decrypt");
    console.log("5. Exit");

    const choice = (await ask("\nChoose an option: ")).trim();

    try {
        if (choice === "1" || choice === "2") {
            const text = await ask("Enter text: ");
            const shiftText = await ask("Enter shift (0-25): ");
            const shift = Number(shiftText);

            if (
                shiftText.trim() === "" ||
                !Number.isInteger(shift) ||
                shift < 0 ||
                shift > 25
            ) {
                throw new Error("Shift must be an integer from 0 to 25.");
            }

            const actualShift = choice === "1" ? shift : -shift;
            console.log(
                "\nResult:",
                caesarCipher(text, actualShift)
            );
        } else if (choice === "3") {
            const text = await ask("Enter text to encrypt: ");
            const password = await ask("Enter encryption password: ");

            if (!password) {
                throw new Error("Password cannot be empty.");
            }

            console.log("\nEncrypted data:");
            console.log(aesEncrypt(text, password));
        } else if (choice === "4") {
            const encryptedData = await ask(
                "Paste the complete encrypted JSON: "
            );
            const password = await ask("Enter decryption password: ");

            if (!password) {
                throw new Error("Password cannot be empty.");
            }

            console.log("\nDecrypted text:");
            console.log(aesDecrypt(encryptedData, password));
        } else if (choice === "5") {
            console.log("Exiting toolkit.");
        } else {
            console.log("Invalid option. Choose 1 to 5.");
        }
    } catch (error) {
        console.log("\nOperation failed:", error.message);
    } finally {
        rl.close();
    }
}

main();
