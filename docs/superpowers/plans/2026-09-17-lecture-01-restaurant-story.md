# Lecture 01 Restaurant Story Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace RideShare as the narrative thread in Lecture 01 with a simple family-restaurant ordering story while preserving the 29-slide course structure and separate professor/student editions.

**Architecture:** The private professor PPTX remains the editable source of truth and retains speaker notes. The public student PPTX is derived from it with all notes removed, then copied to the canonical material path and legacy public alias. The manifest and download tests verify the public artifact.

**Tech Stack:** PowerPoint/PPTX, bundled presentation tooling, ZIP package inspection, Node.js tests, Google Drive

**Spec:** `docs/superpowers/specs/2026-09-17-lecture-story-live-attendance-design.md`

---

## Chunk 1: Deck content and publication

### Task 1: Record the current artifacts

**Files:**
- Read: `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx`
- Read: `materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx`
- Read: `Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx`
- Read: `materials/manifest.json`

- [ ] **Step 1: Verify all expected inputs exist**

Run:

```bash
test -f /Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx
test -f materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx
test -f Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx
```

Expected: exit 0.

- [ ] **Step 2: Record slide counts, notes presence and SHA-256 values outside the repo**

Run:

```bash
python3 - <<'PY' > /tmp/lecture-01-baseline.txt
from pathlib import Path
from zipfile import ZipFile
import hashlib
paths = [
  Path('/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx'),
  Path('materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx'),
  Path('Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx'),
]
for path in paths:
  with ZipFile(path) as z:
    names=z.namelist()
    slides=sum(n.startswith('ppt/slides/slide') and n.endswith('.xml') for n in names)
    notes=sum(n.startswith('ppt/notesSlides/notesSlide') and n.endswith('.xml') for n in names)
  print(path, slides, notes, hashlib.sha256(path.read_bytes()).hexdigest())
PY
cat /tmp/lecture-01-baseline.txt
```

Expected: 29 slides in each deck; notes present only in the professor source.

- [ ] **Step 3: Create and publish the stable demonstration destination**

Create a mobile-first, self-contained restaurant-order demonstration at `demo/restaurant/index.html`. It must support the complete local flow Menu → Cart → Order → Ready with synthetic data, clearly say `Demo — nuk regjistron pjesëmarrjen`, require no login and make no production database writes. Add assertions to `tests/materials.test.js` that the file exists, contains the demo disclosure and exposes all four flow states. Run `node --test tests/materials.test.js`, commit the demo and its test as `Add restaurant ordering demonstration`, push the focused branch and merge its reviewed pull request.

- [ ] **Step 4: Verify the public demonstration URL before QR generation**

Wait for the GitHub Pages deployment associated with the merge to pass, then require `https://arbenl.github.io/demo/restaurant/` to return HTTP 200 and contain `Demo — nuk regjistron pjesëmarrjen`. Only after this check succeeds may Task 2 generate the fixed QR payload.

### Task 2: Replace the RideShare narrative in the professor source

**Files:**
- Modify: `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx`

- [ ] **Step 1: Render the current professor deck for visual reference**

Use `@presentations:Presentations` and render every slide to a temporary review directory.

Expected: a complete 29-slide montage with no rendering failures.

- [ ] **Step 2: Create a reproducible edit script**

Create `/Users/arbenlila/.codex/visualizations/2026/09/17/01a0ae05-808a-7cc3-853c-c777a5f052a9/semester/restaurant-story/.build/build-restaurant-story.mjs`. Import the professor source with `PresentationFile.importPptx`, edit existing text frames and notes in place, export `.build/professor-candidate.pptx`, and call `finalizePresentation` to write `output/Ligjerata-01-PROFESORI-me-notes.pptx`. Use:

```text
NODE=/Users/arbenlila/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
NODE_PATH=/Users/arbenlila/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules
SKILL=/Users/arbenlila/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations
WORK=/Users/arbenlila/.codex/visualizations/2026/09/17/01a0ae05-808a-7cc3-853c-c777a5f052a9/semester/restaurant-story
```

Reuse the import/export/finalizer pattern from `semester/.build/update-deck.mjs` and the notes-removal logic from `semester/.build/split-lecture-notes.mjs`. Do not use `python-pptx`.

- [ ] **Step 3: Apply the slide-specific story edits**

Keep slides 3–9 course content unchanged except for notes that call RideShare the course example. Apply these edits:

```text
Slide 1: replace the RideShare phone with a one-restaurant ordering screen; show “A mund të porosis?”, one meal, quantity and “Porosit”.
Slide 2: call the restaurant a lecture example and keep the student's real-business project message.
Slides 10–11: keep the chair and evidence analogies; replace RideShare questions with restaurant-order questions.
Slide 12: 11:45, customer message, missing confirmation; show phone/Instagram/order uncertainty.
Slide 13: “Mesazhi nuk është porosi”; expose missing meal, quantity, address and status.
Slide 14: hypothesis that structured checkout and visible status reduce uncertainty; keep the 4/5 usability threshold as hypothetical.
Slide 15: define PRD in plain language: the short document that states the user, problem, main flow, boundaries and acceptance criteria before coding. Apply it to one customer ordering from one family restaurant; no payments or courier GPS.
Slide 16: three abilities are View menu, Place order, Update status; exclude payments, multi-vendor marketplace, live courier tracking and ratings.
Slides 17–18: map the paper prototype and acceptance criteria to Menu → Cart → Order → Ready.
Slide 19: define PWA in plain language: a phone-friendly web app opened from a link, installable when supported, with deliberately designed offline behavior. Explain why it fits a restaurant pilot without an initial App Store release.
Slide 20: phone/server/data architecture for creating an order and changing availability/status.
Slide 21: only restaurant staff may change menu availability or order status.
Slide 22: cached menu may be read offline and labeled stale; placing an order requires server confirmation.
Slide 23: distinguish locally sent, received, preparing, ready and failed/unknown.
Slide 24: keep the AI responsibility lesson and use order identity, availability and retries as examples.
Slide 25: replace “Ndërto RideShare” with a scoped prompt for a duplicate-safe restaurant order.
Slides 26–27: keep grading and Demo Day; use unavailable meal, lost network and unauthorized menu edit as failure examples.
Slide 28: live restaurant demo with `QR I DEMONSTRIMIT — nuk regjistron pjesëmarrjen`. Generate the QR from the fixed public URL `https://arbenl.github.io/demo/restaurant/`; do not use an attendance token or a temporary localhost URL.
Slide 29: preserve the exit ticket and add the closing: “15 javë më vonë, këtë mund ta ndërtoni ju. Filloni me një biznes. Gjeni një problem. Ndërtoni një rrjedhë që funksionon.”
```

On slide 28, add a compact comparison callout: `QR I PJESËMARRJES — vetëm në mes të orës; regjistron praninë` versus `QR I DEMONSTRIMIT — në fund; hap aplikacionin dhe nuk regjistron praninë`. Only the demonstration QR itself appears on this slide.

- [ ] **Step 4: Rewrite speaker notes to support the 90-minute arc**

Assign explicit timing and narrative intent:

```text
Slides 1–3, 00:00–12:00: Mesazhi and the semester promise.
Slides 4–14, 12:00–30:00: Kaosi — connect the course structure and evidence mindset to the lost order, incomplete address and missing status.
Slides 15–18, 30:00–52:00: Vendimi — PRD and Menu → Cart → Order → Ready.
Slides 19–25, 52:00–75:00: Ndërtimi — Next.js, Supabase, RLS, offline and tests.
Slides 26–29, 75:00–90:00: Prova live — evidence, grading, Demo Day, demonstration QR, order status “Gati”, closing and exit ticket.
```

Each changed note must contain the professor script, one student question and one engineering warning. Remove all visible and note-level claims that RideShare is the lecture's continuing example.

- [ ] **Step 5: Render and inspect all 29 slides**

Expected: no overlaps, clipped text, unreadable QR labels or remaining RideShare narrative. A textual package search may find metadata; visible slide text must not present RideShare as the semester project.

- [ ] **Step 6: Validate the professor PPTX package**

The edit script must call `finalizePresentation` with:

```js
{
  workspaceDir: WORK,
  candidatePath: WORK + '/.build/professor-candidate.pptx',
  finalPath: WORK + '/output/Ligjerata-01-PROFESORI-me-notes.pptx',
  pythonExecutable: '/Users/arbenlila/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  integrityValidatorPath: SKILL + '/container_tools/inspect_presentation_package_integrity.py',
  layoutValidatorPath: SKILL + '/container_tools/inspect_presentation_layout_geometry.py',
  layoutArgs: ['--expected-slide-size-emu','12192000,6858000','--validate-heading-fit'],
  explicitTotalSlideCount: 29,
  verifyArtifactToolImport: true,
  receiptPath: WORK + '/.build/professor.validation.json'
}
```

Use the reference font policy for `Helvetica Neue`, the professor source path and its computed SHA-256. Run:

```bash
NODE_PATH="$NODE_PATH" "$NODE" "$WORK/.build/build-restaurant-story.mjs"
```

Expected: finalizer success, 29 slides, notes present, valid relationships and no missing required font.

- [ ] **Step 7: Replace the canonical private professor source atomically**

After the candidate passes finalization and visual review, copy it to a temporary sibling of `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-PROFESORI-me-notes.pptx`, verify that its SHA-256 matches `$WORK/output/Ligjerata-01-PROFESORI-me-notes.pptx`, and rename the temporary file over the canonical source. Reopen the canonical path and confirm 29 slides and notes before rebuilding the archive or updating Drive.

### Task 3: Produce the public student edition

**Files:**
- Modify: `materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx`
- Modify: `Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx`
- Modify: `materials/manifest.json`
- Test: `tests/materials.test.js`

- [ ] **Step 1: Derive a student copy from the approved professor deck**

Create `$WORK/.build/split-student.mjs` from the existing `semester/.build/split-lecture-notes.mjs`. Remove `ppt/notesSlides/*`, `ppt/notesMasters/*`, slide relationships of type `/notesSlide`, `presentation.xml.rels` relationships of type `/notesMaster`, `<p:notesMasterIdLst>` and every matching `[Content_Types].xml` override. Preserve all 29 slide visuals. Finalize to `$WORK/output/Ligjerata-01-STUDENTI-pa-notes.pptx` with a separate candidate and receipt.

- [ ] **Step 2: Validate absence of notes**

Run:

```bash
unzip -l "$WORK/output/Ligjerata-01-STUDENTI-pa-notes.pptx" | rg 'notes(Slides|Masters)' && exit 1 || true
python3 - <<'PY'
from pathlib import Path
from zipfile import ZipFile
deck = Path('/Users/arbenlila/.codex/visualizations/2026/09/17/01a0ae05-808a-7cc3-853c-c777a5f052a9/semester/restaurant-story/output/Ligjerata-01-STUDENTI-pa-notes.pptx')
with ZipFile(deck) as package:
    content_types = package.read('[Content_Types].xml').decode('utf-8')
assert 'notesSlides' not in content_types
assert 'notesMasters' not in content_types
PY
```

Expected: no note-slide or note-master parts and no dangling note relationships.

- [ ] **Step 3: Copy the identical student file to both public paths**

Expected: `shasum -a 256` returns the same hash for both paths.

- [ ] **Step 4: Update the manifest**

Set the new SHA-256 and keep:

```json
{
  "slides": 29,
  "audience": "student",
  "speakerNotes": false
}
```

- [ ] **Step 5: Strengthen the material test**

Add assertions that the canonical and legacy files have the same hash and that the PPTX ZIP contains no notes paths.

- [ ] **Step 6: Run the material test and full Node test suite**

Run:

```bash
node --test tests/materials.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit the public artifacts**

```bash
git add Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx materials/manifest.json tests/materials.test.js
git commit -m "Update Lecture 01 restaurant story"
```

### Task 4: Sync the private course archive

**Files:**
- Modify: `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/Ligjerata-01-STUDENTI-pa-notes.pptx`
- Modify: `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027/java-01/ligjerata-01.pptx`
- Modify: `/Users/arbenlila/Documents/AAB/Programimi-Mobile-2026-2027.zip`

- [ ] **Step 1: Copy the validated student deck to both local student names**

Expected: all three student copies have the manifest hash.

- [ ] **Step 2: Rebuild the local semester ZIP**

Run from `/Users/arbenlila/Documents/AAB`:

```bash
rm -f Programimi-Mobile-2026-2027.zip.new
ditto -c -k --sequesterRsrc --keepParent Programimi-Mobile-2026-2027 Programimi-Mobile-2026-2027.zip.new
unzip -t Programimi-Mobile-2026-2027.zip.new
unzip -l Programimi-Mobile-2026-2027.zip.new | rg 'Programimi-Mobile-2026-2027/(java-(01|15)|modelet|grading|index.html|LEXO-FILLIMISHT.md)'
mv Programimi-Mobile-2026-2027.zip.new Programimi-Mobile-2026-2027.zip
```

Expected: integrity passes, the archive keeps the single `Programimi-Mobile-2026-2027/` root and contains the first/last week, templates, grading and index files.

- [ ] **Step 3: Update the existing Google Drive files in place**

Use `mcp__codex_apps__google_drive_update_file` with MIME `application/vnd.openxmlformats-officedocument.presentationml.presentation`:

```text
Professor: 13W-fGe2zsN0v9ZsXCiHZfJtO7f4VlV_9
Student:   1ja8X3jc2E-6wa9O1Nd-0why-oSmny2g7
ZIP:       1SRkrBaSDzjktqB5CZ8kUgir3ZoM7H3M1
```

Use MIME `application/zip` for the ZIP. Update each file with its exact local path; do not create new files.

- [ ] **Step 4: Read back Drive metadata**

Use the Drive metadata/read tool on all three IDs and list the root folder `1iBk4QVz3Fzv9Q3FEbY-Mzmpord7GfE20`. Expected: updated timestamps, correct filenames, private access and exactly one entry for each filename.

### Task 5: Final presentation verification

- [ ] **Step 1: Render the professor and student copies side by side**

Expected: slide visuals match; only the professor edition contains notes.

- [ ] **Step 2: Verify public download references**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
html=Path('index.html').read_text()
canonical='materials/lectures/ligjerata-01-aab-biznes-real-2026-v2.pptx'
assert html.count(f'href="{canonical}"') == 2
assert 'href="Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx"' not in html
assert Path('Jave1_Hyrje_Nextjs_PWA_Copilot_2026.pptx').is_file()
PY
```

Expected: the portal has exactly two canonical download links; the legacy alias exists only as a compatibility file.

- [ ] **Step 3: Run final repository checks**

Run:

```bash
git diff --check
npm test
git status --short
```

Expected: tests pass; only intentional changes or the existing PowerPoint lock file remain.
