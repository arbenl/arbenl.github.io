# Prova e Kolokviumit I me 70 studentë

**Rezultati: kaloi.** U përdorën 70 identitete testuese në një databazë dhe server lokal të izoluar, me pyetjet reale të ruajtura të enkriptuara. Nuk u krijuan studentë, nota ose kolokviume në prodhim.

Të 70 klientët kryen hyrjen përmes NextAuth Credentials, u regjistruan në G1, plotësuan dhe ruajtën 700 përgjigje. Rifreskimi riktheu të njëjtat alternativa dhe përgjigje. 35 studentë dorëzuan herët; 35 u vlerësuan automatikisht pas afatit. Koha nuk u përshpejtua dhe databaza nuk u ndryshua për të simuluar skadimin.

| Kontrolli | Rezultati |
|---|---|
| Studentë dhe rezultate unike | 70 nga 70 |
| Pikë të krahasuara individualisht me rezultatin e pritshëm | 70 nga 70 të sakta |
| Përgjigje të ruajtura dhe rikthyera pas rifreskimit | 700 nga 700 |
| Kohëzgjatja e përcaktuar në server | 600 sekonda |
| Nisja, Europe/Berlin | 28.10.2026 15:47:35 |
| Afati, Europe/Berlin | 28.10.2026 15:57:35 |
| Lista e parë u mor pas nisjes | 600.188 sekonda |
| Rezultatet para afatit | Të fshehura |
| Kërkesa HTTP | 1256 |
| Përgjigje HTTP të papritura | 0 |
| Përgjigje e vonuar pas afatit | U refuzua me 409 |
| Grupi G2 | Mbeti në pritje |
| Vijueshmëri e krijuar nga kolokviumi | 0 |
| Vonesa lokale p50 / p95 / maksimum | 126 / 411 / 603 ms |

Kjo është provë me **70 klientë HTTP të pavarur**, jo me 70 telefona fizikë. Provat reale në browser në 320, 375 dhe 430 pikselë dokumentohen veçmas në provat Playwright. Serveri i kësaj prove përdori backend-in e rishikuar `d2d7c50`. Rezultatet më poshtë janë vetëm të identiteteve testuese.

Për përsëritje lokale: ndërto aplikacionin dhe ekzekuto `python3 scripts/test-colloquium-load.py --bank-key-file /path/to/ignored-key-file --output-dir /tmp/colloquium-evidence`. Skripti krijon dhe heq vetë databazën dhe serverin lokal, refuzon mjedisin Vercel dhe nuk shkarkon kredenciale prodhimi. Mos e vendos vlerën e çelësit në argumente ose Git.

## Lista sipas alfabetit

| Emri testues | Grupi | Pikët |
|---|---|---|
| Arta Test 001 | G1 | 0/10 |
| Arta Test 008 | G1 | 7/10 |
| Arta Test 015 | G1 | 3/10 |
| Arta Test 022 | G1 | 10/10 |
| Arta Test 029 | G1 | 6/10 |
| Arta Test 036 | G1 | 2/10 |
| Arta Test 043 | G1 | 9/10 |
| Arta Test 050 | G1 | 5/10 |
| Arta Test 057 | G1 | 1/10 |
| Arta Test 064 | G1 | 8/10 |
| Besa Test 002 | G1 | 1/10 |
| Besa Test 009 | G1 | 8/10 |
| Besa Test 016 | G1 | 4/10 |
| Besa Test 023 | G1 | 0/10 |
| Besa Test 030 | G1 | 7/10 |
| Besa Test 037 | G1 | 3/10 |
| Besa Test 044 | G1 | 10/10 |
| Besa Test 051 | G1 | 6/10 |
| Besa Test 058 | G1 | 2/10 |
| Besa Test 065 | G1 | 9/10 |
| Çlirim Test 003 | G1 | 2/10 |
| Çlirim Test 010 | G1 | 9/10 |
| Çlirim Test 017 | G1 | 5/10 |
| Çlirim Test 024 | G1 | 1/10 |
| Çlirim Test 031 | G1 | 8/10 |
| Çlirim Test 038 | G1 | 4/10 |
| Çlirim Test 045 | G1 | 0/10 |
| Çlirim Test 052 | G1 | 7/10 |
| Çlirim Test 059 | G1 | 3/10 |
| Çlirim Test 066 | G1 | 10/10 |
| Drita Test 004 | G1 | 3/10 |
| Drita Test 011 | G1 | 10/10 |
| Drita Test 018 | G1 | 6/10 |
| Drita Test 025 | G1 | 2/10 |
| Drita Test 032 | G1 | 9/10 |
| Drita Test 039 | G1 | 5/10 |
| Drita Test 046 | G1 | 1/10 |
| Drita Test 053 | G1 | 8/10 |
| Drita Test 060 | G1 | 4/10 |
| Drita Test 067 | G1 | 0/10 |
| Ëndrra Test 005 | G1 | 4/10 |
| Ëndrra Test 012 | G1 | 0/10 |
| Ëndrra Test 019 | G1 | 7/10 |
| Ëndrra Test 026 | G1 | 3/10 |
| Ëndrra Test 033 | G1 | 10/10 |
| Ëndrra Test 040 | G1 | 6/10 |
| Ëndrra Test 047 | G1 | 2/10 |
| Ëndrra Test 054 | G1 | 9/10 |
| Ëndrra Test 061 | G1 | 5/10 |
| Ëndrra Test 068 | G1 | 1/10 |
| Genti Test 006 | G1 | 5/10 |
| Genti Test 013 | G1 | 1/10 |
| Genti Test 020 | G1 | 8/10 |
| Genti Test 027 | G1 | 4/10 |
| Genti Test 034 | G1 | 0/10 |
| Genti Test 041 | G1 | 7/10 |
| Genti Test 048 | G1 | 3/10 |
| Genti Test 055 | G1 | 10/10 |
| Genti Test 062 | G1 | 6/10 |
| Genti Test 069 | G1 | 2/10 |
| Lira Test 007 | G1 | 6/10 |
| Lira Test 014 | G1 | 2/10 |
| Lira Test 021 | G1 | 9/10 |
| Lira Test 028 | G1 | 5/10 |
| Lira Test 035 | G1 | 1/10 |
| Lira Test 042 | G1 | 8/10 |
| Lira Test 049 | G1 | 4/10 |
| Lira Test 056 | G1 | 0/10 |
| Lira Test 063 | G1 | 7/10 |
| Lira Test 070 | G1 | 3/10 |
