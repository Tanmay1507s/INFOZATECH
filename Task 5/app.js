
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const datasetPath = path.join(__dirname, "dataset.csv");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer.trim()));
    });
}

function extractFeatures(input) {
    let url;

    try {
        url = new URL(
            /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
                ? input
                : `http://${input}`
        );
    } catch {
        throw new Error("Please enter a valid URL.");
    }

    const hostname = url.hostname.toLowerCase();
    const fullURL = url.href.toLowerCase();

    const isIPv4 =
        /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

    return {
        longURL: fullURL.length > 75,
        hasAt: fullURL.includes("@"),
        usesHTTPS: url.protocol === "https:",
        usesIP: isIPv4,
        manySubdomains: hostname.split(".").length > 3,
        hasHyphen: hostname.includes("-"),
        suspiciousWords:
            /login|verify|account|update|secure|free|prize|bank|password|confirm/i
                .test(fullURL),
        manyDots: (hostname.match(/\./g) || []).length > 3
    };
}

// Train a simple Bernoulli Naive Bayes classifier
function trainModel(rows) {
    const features = [
        "longURL",
        "hasAt",
        "usesHTTPS",
        "usesIP",
        "manySubdomains",
        "hasHyphen",
        "suspiciousWords",
        "manyDots"
    ];

    const model = {
        legitimate: { total: 0, counts: {} },
        phishing: { total: 0, counts: {} }
    };

    for (const label of ["legitimate", "phishing"]) {
        for (const feature of features) {
            model[label].counts[feature] = 0;
        }
    }

    for (const row of rows) {
        const label = row.label;
        if (!model[label]) continue;

        const values = extractFeatures(row.url);
        model[label].total++;

        for (const feature of features) {
            if (values[feature]) {
                model[label].counts[feature]++;
            }
        }
    }

    if (!model.legitimate.total || !model.phishing.total) {
        throw new Error(
            "Dataset must contain both legitimate and phishing examples."
        );
    }

    return { model, features };
}

function predict(input, trained) {
    const { model, features } = trained;
    const values = extractFeatures(input);
    const total = model.legitimate.total + model.phishing.total;

    const logScores = {};

    for (const label of ["legitimate", "phishing"]) {
        const classData = model[label];

        // Smoothed class prior
        let score = Math.log(
            (classData.total + 1) / (total + 2)
        );

        for (const feature of features) {
            const count = classData.counts[feature];

            // Laplace smoothing for binary features
            const probability =
                (count + 1) / (classData.total + 2);

            score += values[feature]
                ? Math.log(probability)
                : Math.log(1 - probability);
        }

        logScores[label] = score;
    }

    const difference =
        logScores.phishing - logScores.legitimate;

    const phishingProbability =
        1 / (1 + Math.exp(-Math.max(-500, Math.min(500, difference))));

    return {
        values,
        phishingProbability,
        prediction:
            logScores.phishing > logScores.legitimate
                ? "Potential phishing"
                : "Likely legitimate"
    };
}

async function main() {
    try {
        if (!fs.existsSync(datasetPath)) {
            throw new Error("dataset.csv was not found.");
        }

        const lines = fs.readFileSync(datasetPath, "utf8")
            .split(/\r?\n/)
            .filter(line => line.trim());

        const rows = lines.slice(1).map(line => {
            const comma = line.indexOf(",");
            if (comma === -1) return null;

            return {
                label: line.slice(0, comma).trim().toLowerCase(),
                url: line.slice(comma + 1).trim()
            };
        }).filter(row =>
            row &&
            ["legitimate", "phishing"].includes(row.label) &&
            row.url
        );

        const trained = trainModel(rows);

        console.log("\n=== PHISHING URL DETECTOR ===");
        console.log(`Training examples loaded: ${rows.length}`);
        console.log("\nNote: This is an educational model.");
        console.log("Its predictions are not proof that a site is safe or malicious.");

        while (true) {
            const input = await ask(
                "\nEnter a URL (or type exit): "
            );

            if (input.toLowerCase() === "exit") break;

            try {
                const result = predict(input, trained);

                console.log("\n--- Assessment ---");
                console.log("URL:", input);
                console.log("Prediction:", result.prediction);
                console.log(
                    "Estimated model phishing score:",
                    `${(result.phishingProbability * 100).toFixed(1)}%`
                );

                console.log("\nExtracted features:");
                for (const [feature, value] of
                    Object.entries(result.values)) {
                    console.log(
                        `${feature}: ${value ? "Yes" : "No"}`
                    );
                }

                console.log(
                    "\nThis score reflects the small training dataset, " +
                    "not a verified real-world probability."
                );
            } catch (error) {
                console.log("Error:", error.message);
            }
        }
    } catch (error) {
        console.error("Could not start detector:", error.message);
    } finally {
        rl.close();
    }
}

main();
