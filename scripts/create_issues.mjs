import fs from 'fs';

const repo = "Ixotic27/The-Leetcode-City";
const token = fs.readFileSync(".env.local", "utf-8")
    .split("\n")
    .find(line => line.startsWith("GITHUB_TOKEN="))
    ?.split("=")[1]?.trim();

if (!token) {
    console.error("No GITHUB_TOKEN found in .env.local");
    process.exit(1);
}

const headers = {
    "Accept": "application/vnd.github.v3+json",
    "Authorization": `token ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Node-Script"
};

async function createLabel(name, color, description) {
    const res = await fetch(`https://api.github.com/repos/${repo}/labels`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, color, description })
    });
    if (res.status === 201) {
        console.log(`Created label: ${name}`);
    } else if (res.status === 422) {
        console.log(`Label ${name} already exists.`);
    } else {
        console.error(`Failed to create label ${name}:`, await res.text());
    }
}

async function createIssue(title, body, labels) {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, body, labels })
    });
    if (res.status === 201) {
        const issue = await res.json();
        console.log(`Created issue: ${title} (#${issue.number})`);
    } else {
        console.error(`Failed to create issue ${title}:`, await res.text());
    }
}

async function run() {
    await createLabel("good first issue", "7057ff", "Good for newcomers");
    await createLabel("beginner", "0e8a16", "Beginner friendly task");
    await createLabel("intermediate", "fbca04", "Intermediate level task");

    const issues = [
        {
            title: "Add Screenshots to README",
            body: "The `README.md` has a TODO to add screenshots. We need some nice screenshots of the 3D city, profile page, and compare mode.\n\nThis is a great issue for anyone looking to make their first contribution!",
            labels: ["good first issue", "beginner"]
        },
        {
            title: "Translate Portuguese strings to English in Share Card API",
            body: "There are some hardcoded Portuguese strings like `TODO ARRANHA-CEU COMEÇA EM ALGUM LUGAR` in `src/app/api/share-card/[username]/route.tsx` that need to be translated to English for internationalization.\n\nThis is a great issue for beginners looking to contribute to the codebase.",
            labels: ["good first issue", "beginner"]
        },
        {
            title: "Implement actual Push Notifications",
            body: "There is a TODO in `src/lib/notifications.ts` to replace placeholder push notification code with actual FCM/APNs/Web Push integration.\n\nThis requires some backend and frontend knowledge.",
            labels: ["good first issue", "intermediate"]
        },
        {
            title: "Create a new Weather Effect in CityScene",
            body: "We want to add a new weather effect (like snow or rain) to the 3D scene in `src/components/CityScene.tsx` to make the city feel more alive. You can use React Three Fiber to implement this.\n\nGreat issue for those looking to learn or practice 3D graphics in the browser.",
            labels: ["good first issue", "intermediate"]
        },
        {
            title: "Add Unit Tests for utility functions",
            body: "We need Jest or Vitest unit tests for the helper functions located in the `src/lib/` directory to improve code reliability. Pick one or more utility functions and add comprehensive test coverage.\n\nExcellent issue to practice writing unit tests.",
            labels: ["good first issue", "intermediate"]
        }
    ];

    for (const issue of issues) {
        await createIssue(issue.title, issue.body, issue.labels);
    }
}

run().catch(console.error);
