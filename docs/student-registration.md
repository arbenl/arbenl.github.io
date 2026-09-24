# Regjistrimi një herë · Mobile 2026/2027

Studenti hyn me të njëjtën llogari GitHub dhe skanon QR-në e profesorit në ligjëratën ose ushtrimet e para. Nëse profili nuk ekziston, plotëson emrin, mbiemrin, indeksin, grupin dhe emailin për materialet. Semestri i vetëm aktiv zgjidhet automatikisht. Nuk nevojitet import paraprak nga profesori.

Një QR i vlefshëm jep deri në 10 minuta për plotësimin e profilit, vetëm për llogarinë që e skanoi dhe grupin/semestrin përkatës. Kjo leje nuk regjistron vijueshmëri dhe nuk zgjat vlefshmërinë e QR-së. Nëse QR-ja skadon gjatë plotësimit, profili ruhet dhe studenti skanon sërish kodin e ri. Në orët e tjera nuk plotësohet formulari.

Profilet e vjetra pa email e plotësojnë atë një herë. Indeksi, llogaria GitHub dhe emaili janë unikë brenda semestrit. Studentët nuk mund të mbishkruajnë një profil të lidhur me tjetër llogari ose të ndryshojnë emailin e ruajtur nga kjo rrugë.

Emri dhe emaili janë të deklaruar nga studenti; dy shkrimet e emailit parandalojnë gabimet e shtypit, jo verifikimin e pronësisë së adresës. Profesori shkarkon regjistrin privat me email nga paneli. Emaili nuk shfaqet në projektor. Dhënia automatike e lejeve në Google Drive nuk është ende e lidhur me aplikacionin.

## Deployment

Apply `attendance-app/drizzle/0001_roster_email.sql` before deploying this release, or open the authenticated staff panel immediately after deployment: its serialized, staff-only course setup applies the same additive migration. This additive, idempotent migration preserves existing records. The previous app remains compatible with the new nullable column. Do not drop the column during rollback.
