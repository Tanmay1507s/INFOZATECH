
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
