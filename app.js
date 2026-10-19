
const readline = require("node:readline/promises");
const crypto = require("node:crypto");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

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
