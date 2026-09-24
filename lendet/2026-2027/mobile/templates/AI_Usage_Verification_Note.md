# SHËNIMI ZYRTAR I PËRDORIMIT DHE VERIFIKIMIT TË AI-së

**Shkurtesat:** PWA (Progressive Web App – aplikacion web progresiv); AI (Artificial Intelligence – inteligjencë artificiale).
**Kursi:** Programimi për Pajisje Mobile • **Kolegji AAB**  
**Detyra / Java:** [P.sh. Detyra Javore 3 / Projekti PWA]  
**Studenti:** [Emri Mbiemri, ID e Studentit]  
**Veglat e Përdorura:** GitHub Copilot Pro / ChatGPT / Claude / Gemini

---

## Politika Institucionale e Kolegjit AAB:
> *"Ju jeni arkitekti i sistemit; inteligjenca artificiale është thjesht bashkë-piloti juaj. Lejohet dhe inkurajohet përdorimi i AI-së për shpejtësi, por ju mbani 100% përgjegjësi akademike dhe teknike për çdo rresht kodi që dorëzoni."*

---

## Formulari i Deklarimit të Punës me AI:

### 1. Çfarë e pyetët AI-në? (Prompts & Intent)
- *Shënoni shkurtimisht çfarë problemi u përpoqët të zgjidhni:*
  > [Shembull: "I kërkova Copilot-it të krijojë një server action në Next.js 15 për të ruajtur rezervimin e udhëtimit në tabelën bookings të Supabase me RLS."]

### 2. Çfarë kodi propozoi AI?
- *Shkurtimisht, çfarë gjeneroi modeli:*
  > [Shembull: "Copilot gjeneroi funksionin createBooking, por përdori importin e vjetër të Supabase dhe harroi të trajtojë rastin kur nuk ka vende të lira."]

### 3. Çfarë modifikuat ju personalisht? (Kritika & Rregullimi Njerëzor)
- *Cilat gabime ose boshllëqe rregulluat para se ta përfshinit në repo:*
  > [Shembull: "Përditësova klientin me @supabase/ssr, shtova kontrollin logjik `if (available_seats < 1) throw Error()`, dhe optimizova tipet në TypeScript."]

### 4. Si e verifikuat që kodi funksionon saktë? (Testimi)
- [ ] Testova me sukses në shfletues lokal (`npm run dev`).
- [ ] Testova në celularin fizik (ekran me madhësi mobile).
- [ ] Testova me lidhje interneti të dobët / fikur (Offline test).
- [ ] Kontrollova që të dhënat ruhen saktë në tabelën përkatëse në Supabase.
- [ ] CI/CD pipeline në GitHub Actions kaloi me status të gjelbër (Build passed).

**Deklarata e Studentit:**  
*"Konfirmoj se jam plotësisht në gjendje të shpjegoj rresht për rresht këtë kod gjatë vlerësimit gojor me profesorin dhe asistentin."*  
Data: ___ / ___ / 2026
