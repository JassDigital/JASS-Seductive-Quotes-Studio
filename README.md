# JASS Seductive Quotes Studio v1.2.0

A Windows-first, local-first Electron + React desktop app for browsing literary quotations and original expressions, designing quote cards, and harvesting candidate passages from your own documents.

## What's new in v1.1 — Integrated Quote Collector with intelligent filtering and bulk review
- Choose local TXT, Markdown, HTML, EPUB, or text-based PDF documents.
- Extract candidate passages locally; no cloud AI, upload, or remote quote service.
- Review and edit each passage, author attribution, and work/book before saving.
- Preserve source filename and an approximate segment location with every candidate.
- Save collected passages in a local SQLite database managed by Electron using sql.js (no native C++ module compilation).
- Return to Quote Studio and export selected quotes as PNG cards.
- Existing browsing, mood filters, favourites, JSON import, and original-expression composer remain available.

## Important limitations
- Extraction is heuristic: it finds passage-sized text blocks, not necessarily memorable or quotable sentences.
- A source filename is provenance, not proof of authorship. Collected items are marked `REVIEW NEEDED`; verify exact wording and attribution against a trustworthy edition before publishing.
- Scanned/image-only PDFs are not OCR-processed. PDF extraction uses the PDF's embedded text layer.
- EPUB extraction uses its HTML/XHTML content files. Some unusual EPUB layouts may produce noisy text.
- Source location is a segment index, not a printed page number.
- Do not import copyrighted books unless you have the right to use them. Keep extracts for personal research and respect applicable copyright limits.

## Windows setup
Requirements: Node.js 20+ and npm. Run PowerShell in the project directory:

```powershell
npm install
npm run check
npm run dev
```

The SQLite engine uses sql.js, so no native C++ compilation, Visual Studio Build Tools, or Windows SDK is required. Database changes are written to the local SQLite file after each save/delete operation.

Production:
```powershell
npm run build
npm start
```

## Local data
The collector's SQLite database is created under Electron's application user-data directory as `jass-quotes.sqlite`. The exact directory is managed by Electron on Windows (typically under the user's AppData/Roaming folder). The original starter/custom entries and favourites still use localStorage. Do not uninstall/clear app data without first backing up anything important; v1.1 does not yet include a database backup/restore screen.

## Supported document types
- `.txt`, `.md`, `.markdown`
- `.html`, `.htm`
- `.epub`
- `.pdf` (text layer required)

The app processes selected files on the same computer. It does not crawl folders or search the internet.

## Existing JSON import
Choose a JSON array or an object containing a `quotes` array. Records can include `text` or `quote`, `author` or `attribution`, `source` or `work`, `location`, `tags`, `notes`, `source_title`, and `source_url`. Imported records require independent verification.

## Tests
Run `npm run check`. The included Node tests check starter catalogue fields and Electron security defaults. Test suite passing does not substitute for testing document imports on your own Windows machine.

## GitHub publishing
After installing dependencies and verifying the app, run `.\publish-github.ps1`. It stages the source and requires the exact confirmation `YES` before committing/pushing `JassDigital/JASS-Seductive-Quotes-Studio`. Git and GitHub CLI (`gh`) must be installed and authenticated.


## v1.2.0 installation fix
This release replaces `better-sqlite3` with `sql.js` to avoid Windows native-module build failures. The quote database remains a real SQLite file and is saved locally after writes. Existing v1.1 database files should be backed up before switching versions; sql.js reads standard SQLite database files, but make a copy before first launch.


## v1.2 candidate review

The collector assigns heuristic quality scores, suppresses obvious navigation/metadata boilerplate, skips duplicate passages, and offers quality filters plus bulk select/deselect and “Keep recommended”. Scores are triage aids only, not proof of quotation authenticity. SQLite persistence remains local via `sql.js`; no native SQLite build tools are required.
