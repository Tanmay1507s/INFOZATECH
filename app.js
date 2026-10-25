const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline/promises");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const BASELINE_FILE = path.join(__dirname, "baseline.json");

async function hashFile(filePath) {
    const contents = await fs.readFile(filePath);
    return crypto
        .createHash("sha256")
        .update(contents)
        .digest("hex");
}

async function scanFolder(folderPath, currentFolder) {
    const results = {};

    async function visit(directory) {
        const entries = await fs.readdir(directory, {
            withFileTypes: true
        });

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                await visit(fullPath);
            } else if (entry.isFile()) {
                const relativePath = path
                    .relative(folderPath, fullPath)
                    .split(path.sep)
                    .join("/");

                // Avoid following files outside the selected folder.
                // Only regular files in the selected tree are scanned.
                results[relativePath] = await hashFile(fullPath);
            }
        }
    }

    await visit(folderPath);
    return results;
}

async function createBaseline(folderPath) {
    const hashes = await scanFolder(folderPath);

    await fs.writeFile(
        BASELINE_FILE,
        JSON.stringify(
            {
                folder: path.resolve(folderPath),
                createdAt: new Date().toISOString(),
                hashes
            },
            null,
            2
        )
    );

    console.log(`Baseline created with ${Object.keys(hashes).length} files.`);
}

async function checkIntegrity(folderPath) {
    const data = JSON.parse(
        await fs.readFile(BASELINE_FILE, "utf8")
    );

    const previous = data.hashes;
    const current = await scanFolder(folderPath);

    let modified = 0;
    let added = 0;
    let deleted = 0;

    console.log("\n--- Integrity Scan Results ---");

    for (const [file, hash] of Object.entries(current)) {
        if (!(file in previous)) {
            console.log(`[ADDED] ${file}`);
            added++;
        } else if (previous[file] !== hash) {
            console.log(`[MODIFIED] ${file}`);
            modified++;
        }
    }

    for (const file of Object.keys(previous)) {
        if (!(file in current)) {
            console.log(`[DELETED] ${file}`);
            deleted++;
        }
    }

    if (modified + added + deleted === 0) {
        console.log("No changes detected.");
    }

    console.log("\nSummary:");
    console.log(`Modified: ${modified}`);
    console.log(`Added: ${added}`);
    console.log(`Deleted: ${deleted}`);
}

async function main() {
    try {
        const folderInput = await rl.question(
            "Enter the path of the folder you own or manage: "
        );

        const folderPath = path.resolve(folderInput.trim());

        const stats = await fs.stat(folderPath);

        if (!stats.isDirectory()) {
            throw new Error("The specified path is not a folder.");
        }

        // Prevent scanning the baseline's own directory tree.
        const baselinePath = path.resolve(BASELINE_FILE);
        const relative = path.relative(folderPath, baselinePath);

        if (
            relative === "" ||
            (!relative.startsWith(".." + path.sep) &&
                relative !== ".." &&
                !path.isAbsolute(relative))
        ) {
            throw new Error(
                "Choose test folder outside project folder, " +
                "so the baseline is not scanned as a test file."
            );
        }

        console.log("\n1. Create baseline");
        console.log("2. Check for changes");

        const choice = await rl.question("Choose an option (1 or 2): ");

        if (choice === "1") {
            await createBaseline(folderPath);
        } else if (choice === "2") {
            await checkIntegrity(folderPath);
        } else {
            console.log("Invalid option. Enter 1 or 2.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    } finally {
        rl.close();
    }
}

main();

// Small blocklist of commonly used passwords
const commonPasswords = new Set([
    "password",
    "password123",
    "123456",
    "12345678",
    "qwerty",
    "qwerty123",
    "admin",
    "letmein",
    "iloveyou",
    "welcome"
]);

async function main() {
    const password = await rl.question("Enter a test password: ");

    if (password.length === 0) {
        console.log("Password cannot be empty.");
        rl.close();
        return;
    }

    // Character checks
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSymbol = /[^A-Za-z0-9]/.test(password);
    const hasMinimumLength = password.length >= 8;

    // Scoring
    let score = 0;

    if (hasMinimumLength) score++;
    if (hasUppercase) score++;
    if (hasLowercase) score++;
    if (hasDigit) score++;
    if (hasSymbol) score++;

    // Common-password detection (case-insensitive)
    const isCommon = commonPasswords.has(password.toLowerCase());

    // Strength classification
    let strength;

    if (isCommon || password.length < 8 || score <= 2) {
        strength = "Weak";
    } else if (score <= 4) {
        strength = "Medium";
    } else {
        strength = "Strong";
    }

    // Display results
    console.log("\n--- Password Analysis ---");
    console.log(`Length: ${password.length} characters`);
    console.log(`Uppercase letter: ${hasUppercase ? "Yes" : "No"}`);
    console.log(`Lowercase letter: ${hasLowercase ? "Yes" : "No"}`);
    console.log(`Digit: ${hasDigit ? "Yes" : "No"}`);
    console.log(`Symbol: ${hasSymbol ? "Yes" : "No"}`);
    console.log(`Score: ${score}/5`);
    console.log(`Strength: ${strength}`);

    if (isCommon) {
        console.log("Warning: This is a commonly used password.");
    }

    // Improvement feedback
    const suggestions = [];

    if (!hasMinimumLength) {
        suggestions.push("Use at least 8 characters; longer is better.");
    }

    if (!hasUppercase) {
        suggestions.push("Include an uppercase letter.");
    }

    if (!hasLowercase) {
        suggestions.push("Include a lowercase letter.");
    }

    if (!hasDigit) {
        suggestions.push("Include a digit.");
    }

    if (!hasSymbol) {
        suggestions.push("Include a symbol.");
    }

    if (isCommon) {
        suggestions.push("Avoid common passwords and predictable patterns.");
    }

    console.log("\n--- Suggestions ---");

    if (suggestions.length === 0) {
        console.log("Your password meets all five basic checks.");
    } else {
        suggestions.forEach((suggestion, index) => {
            console.log(`${index + 1}. ${suggestion}`);
        });
    }

    // Bonus: approximate time-to-crack estimate
    // This is a simplified theoretical estimate, not a real prediction.
    const characterPool =
        (hasLowercase ? 26 : 0) +
        (hasUppercase ? 26 : 0) +
        (hasDigit ? 10 : 0) +
        (hasSymbol ? 33 : 0);

    if (characterPool > 0) {
        const entropy = password.length * Math.log2(characterPool);
        const guesses = Math.pow(2, entropy);
        const guessesPerSecond = 1e10;
        const seconds = guesses / (2 * guessesPerSecond);

        console.log("\n--- Approximate Crack-Time Estimate ---");
        console.log(`Theoretical entropy: ${entropy.toFixed(2)} bits`);

        if (seconds < 1) {
            console.log("Estimated time: Less than a second.");
        } else if (seconds < 60) {
            console.log(`Estimated time: ${seconds.toFixed(1)} seconds.`);
        } else if (seconds < 3600) {
            console.log(`Estimated time: ${(seconds / 60).toFixed(1)} minutes.`);
        } else if (seconds < 86400) {
            console.log(`Estimated time: ${(seconds / 3600).toFixed(1)} hours.`);
        } else if (seconds < 31536000) {
            console.log(`Estimated time: ${(seconds / 86400).toFixed(1)} days.`);
        } else {
            console.log(
                `Estimated time: ${(seconds / 31536000).toExponential(2)} years.`
            );
        }

        console.log(
            "Note: This simplified estimate assumes random characters and a fixed guessing rate. Real crack times can differ significantly."
        );
    }

    rl.close();
}

main().catch((error) => {
    console.error("An error occurred:", error.message);
    rl.close();
});
