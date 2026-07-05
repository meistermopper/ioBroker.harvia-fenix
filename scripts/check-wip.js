const fs = require("node:fs");
const path = require("node:path");

function checkWip(file) {
	const filePath = path.join(__dirname, "..", file);
	if (!fs.existsSync(filePath)) return;
	const content = fs.readFileSync(filePath, "utf8");

	const wipMarker = "### **WORK IN PROGRESS**";
	const wipIndex = content.indexOf(wipMarker);

	if (wipIndex === -1) {
		console.error(`❌ Fehler: '${wipMarker}' Sektion fehlt in ${file}`);
		process.exit(1);
	}

	const start = wipIndex + wipMarker.length;
	const nextSectionIndex = content.indexOf("### ", start);
	const end = nextSectionIndex !== -1 ? nextSectionIndex : undefined;
	const wipContent = content.substring(start, end).trim();

	if (!wipContent?.includes("*")) {
		console.error(`❌ Fehler: '${wipMarker}' in ${file} ist leer.`);
		console.error("   Bitte Änderungen eintragen, bevor du releast.");
		process.exit(1);
	}
}

checkWip("README.md");
checkWip("README_de.md");

console.log("✅ Changelog (WORK IN PROGRESS) geprüft.");
