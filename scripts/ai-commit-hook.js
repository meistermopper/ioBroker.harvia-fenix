const { execSync } = require("node:child_process");
const fs = require("node:fs");

// Lädt eine lokale .env-Datei (nativ verfügbar ab Node 20.12.0)
if (typeof process.loadEnvFile === "function") {
	try {
		process.loadEnvFile();
	} catch {
		// Ignorieren, falls die Datei nicht existiert
	}
}

// Das erste Argument ist der Pfad zur temporären Commit-Message-Datei (meistens .git/COMMIT_EDITMSG)
const commitMsgFile = process.argv[2];
// Das zweite Argument gibt die Quelle der Nachricht an (z. B. "message", "merge", "template", etc. oder ist leer)
const commitSource = process.argv[3];

if (!commitMsgFile) {
	console.error(
		"[AI-Commit-Hook] Fehler: Kein Pfad zur Commit-Nachrichtendatei übergeben.",
	);
	process.exit(1);
}

/**
 * Holt den Git-Diff der gestageten (vorgemerkten) Änderungen.
 */
function getGitDiff() {
	try {
		return execSync("git diff --cached").toString();
	} catch {
		console.error("[AI-Commit-Hook] Fehler beim Abrufen des Git-Diffs.");
		process.exit(1);
	}
}

/**
 * Ruft die Gemini API auf, um die Commit-Nachricht zu generieren.
 */
async function generateCommitMessage(diff) {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		// Falls kein Key gesetzt ist, warnen wir den Benutzer, brechen den Commit
		// aber nicht ab, damit man wie gewohnt manuell committen kann.
		console.warn(
			"\n⚠️ [AI-Commit-Hook] Warnung: Die Umgebungsvariable GEMINI_API_KEY ist nicht gesetzt!",
		);
		console.warn(
			"Bitte erstelle einen kostenlosen Key im Google AI Studio, um automatische Commit-Nachrichten zu aktivieren.\n",
		);
		return null;
	}

	// Präziser Prompt für detaillierte Commit-Meldungen
	const prompt = `Du bist ein professioneller Git-Experte. Generiere eine detaillierte und strukturierte Commit-Nachricht basierend auf dem folgenden Git-Diff der gestageten Änderungen.
Verwende das Format "Conventional Commits".

Format:
<type>(<scope>): <kurze Zusammenfassung in Englisch>

- <Detaillierte Änderung 1 in Deutsch>
- <Detaillierte Änderung 2 in Deutsch (WAS wurde geändert und vor allem WARUM)>

Regeln:
1. Type muss einer von: feat, fix, docs, style, refactor, perf, test, build, ci, chore sein.
2. Der Scope entspricht dem betroffenen Bereich (z.B. unifi, fritzbox, usv, global, dev, dev-workflow).
3. Die Zusammenfassung im Header soll kurz und prägnant auf Englisch sein und mit einem Kleinbuchstaben beginnen (z.B. "introduce..." statt "Introduce...").
4. Die Stichpunkte im Body sollen tiefgründig und auf Deutsch beschreiben, WAS geändert wurde und WARUM (keine oberflächlichen Kommentare).
5. Jede Zeile im Body darf maximal 72 Zeichen lang sein.
6. Antworte AUSSCHLIESSLICH mit der Commit-Nachricht. Keinen Markdown-Code-Block (\`\`\`), keine Einleitung, keine Erklärung.

Hier ist der Git-Diff:
${diff}`;

	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

	const response = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			contents: [{ parts: [{ text: prompt }] }],
		}),
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Gemini API Fehler: ${response.status} - ${errText}`);
	}

	const data = await response.json();
	const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
	return text ? text.trim() : null;
}

/**
 * Formatiert die Commit-Nachricht, um die Einhaltung von commitlint-Regeln sicherzustellen.
 */
function formatCommitMessage(msg) {
	if (!msg) return msg;
	const lines = msg.split("\n");
	if (lines.length === 0) return msg;

	// 1. Header (Zeile 1) anpassen: Erstes Zeichen des Subjects klein schreiben
	const header = lines[0];
	const headerMatch = header.match(/^([a-z]+)(?:\(([^)]+)\))?:\s*(.*)$/);
	if (headerMatch) {
		const type = headerMatch[1];
		const scope = headerMatch[2] ? `(${headerMatch[2]})` : "";
		let subject = headerMatch[3].trim();
		if (subject.length > 0) {
			subject = subject[0].toLowerCase() + subject.slice(1);
		}
		lines[0] = `${type}${scope}: ${subject}`;
	}

	// Helper zum Umbrechen von Text
	const wrapText = (text, maxLength) => {
		const words = text.split(" ");
		const resultLines = [];
		let currentLine = "";

		for (const word of words) {
			if ((currentLine + (currentLine ? " " : "") + word).length <= maxLength) {
				currentLine += (currentLine ? " " : "") + word;
			} else {
				if (currentLine) {
					resultLines.push(currentLine);
				}
				currentLine = word;
			}
		}
		if (currentLine) {
			resultLines.push(currentLine);
		}
		return resultLines;
	};

	// 2. Body-Zeilen umbrechen
	const formattedLines = [lines[0]];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") {
			formattedLines.push("");
			continue;
		}
		if (line.trim().startsWith("- ")) {
			const content = line.substring(line.indexOf("- ") + 2).trim();
			const wrapped = wrapText(content, 70); // 72 - 2 Zeichen für "- "
			wrapped.forEach((wLine, index) => {
				if (index === 0) {
					formattedLines.push(`- ${wLine}`);
				} else {
					formattedLines.push(`  ${wLine}`);
				}
			});
		} else {
			const wrapped = wrapText(line, 72);
			wrapped.forEach((wLine) => {
				formattedLines.push(wLine);
			});
		}
	}

	return formattedLines.join("\n");
}

async function main() {
	// Wenn der Commit aus einer speziellen Quelle kommt (z. B. ein Merge, ein Amend, oder via Git -m),
	// überschreiben wir nichts.
	if (commitSource && commitSource !== "") {
		return;
	}

	// Prüfen, ob der Benutzer bereits eine Nachricht in das VS Code Textfeld eingetragen hat.
	// Wir lesen die Datei ein und ignorieren alle Git-Kommentare (Zeilen mit #).
	let existingContent = "";
	if (fs.existsSync(commitMsgFile)) {
		existingContent = fs
			.readFileSync(commitMsgFile, "utf-8")
			.split("\n")
			.filter((line) => !line.trim().startsWith("#"))
			.join("\n")
			.trim();
	}

	// Falls das Textfeld bereits ausgefüllt war, brechen wir ab und behalten die Benutzereingabe bei.
	if (existingContent.length > 0) {
		return;
	}

	const diff = getGitDiff();
	if (!diff.trim()) {
		return; // Nichts gestaged, Git bricht den Commit sowieso ab
	}

	console.log(
		"[AI-Commit-Hook] Generiere professionelle Commit-Nachricht via Gemini...",
	);
	try {
		const commitMsg = await generateCommitMessage(diff);
		if (commitMsg) {
			const formattedMsg = formatCommitMessage(commitMsg);
			// Schreiben die generierte Nachricht direkt in die Datei, die Git für den Commit verwendet
			fs.writeFileSync(commitMsgFile, formattedMsg, "utf-8");
			console.log("[AI-Commit-Hook] Commit-Nachricht erfolgreich eingefügt.");
		}
	} catch (err) {
		console.error(
			"\n❌ [AI-Commit-Hook] Fehler bei der Generierung:",
			err.message,
		);
		// Wir lassen den Commit weiterlaufen (als Fallback), damit der Benutzer manuell tippen kann
	}
}

main();
