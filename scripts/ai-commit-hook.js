const { execSync } = require("node:child_process");
const fs = require("node:fs");

// Das erste Argument ist der Pfad zur temporären Commit-Message-Datei (meistens .git/COMMIT_EDITMSG)
const commitMsgFile = process.argv[2];
// Das zweite Argument gibt die Quelle der Nachricht an (z. B. "message", "merge", "template", etc. oder ist leer)
const commitSource = process.argv[3];

if (!commitMsgFile) {
  console.error("[AI-Commit-Hook] Fehler: Kein Pfad zur Commit-Nachrichtendatei übergeben.");
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
    console.warn("\n⚠️ [AI-Commit-Hook] Warnung: Die Umgebungsvariable GEMINI_API_KEY ist nicht gesetzt!");
    console.warn("Bitte erstelle einen kostenlosen Key im Google AI Studio, um automatische Commit-Nachrichten zu aktivieren.\n");
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
2. Der Scope entspricht dem betroffenen Bereich (z.B. unifi, fritzbox, usv, global).
3. Die Zusammenfassung im Header soll kurz und prägnant auf Englisch sein.
4. Die Stichpunkte im Body sollen tiefgründig und auf Deutsch beschreiben, WAS geändert wurde und WARUM (keine oberflächlichen Kommentare).
5. Antworte AUSSCHLIESSLICH mit der Commit-Nachricht. Keinen Markdown-Code-Block (\`\`\`), keine Einleitung, keine Erklärung.

Hier ist der Git-Diff:
${diff}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Fehler: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? text.trim() : null;
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
    existingContent = fs.readFileSync(commitMsgFile, "utf-8")
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

  console.log("[AI-Commit-Hook] Generiere professionelle Commit-Nachricht via Gemini...");
  try {
    const commitMsg = await generateCommitMessage(diff);
    if (commitMsg) {
      // Schreiben die generierte Nachricht direkt in die Datei, die Git für den Commit verwendet
      fs.writeFileSync(commitMsgFile, commitMsg, "utf-8");
      console.log("[AI-Commit-Hook] Commit-Nachricht erfolgreich eingefügt.");
    }
  } catch (err) {
    console.error("\n❌ [AI-Commit-Hook] Fehler bei der Generierung:", err.message);
    // Wir lassen den Commit weiterlaufen (als Fallback), damit der Benutzer manuell tippen kann
  }
}

main();
