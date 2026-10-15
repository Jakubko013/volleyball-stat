# Volejbal Statistika

Aplikace pro záznam volejbalové statistiky během zápasu. Funguje na tabletu, mobilu i PC a i bez internetu.

- Soupiska se stahuje z [cvf.cz](https://www.cvf.cz/souteze/celostatni-souteze). Jde ji také vložit ručně nebo použít uloženou.
- Zapisuje se jedním klepnutím na tlačítko u hráče:
  - **Podání:** eso, v poli, chyba
  - **Přihrávka:** OK, chyba
  - **Útok:** bod, v poli, chyba, zablokován
  - **Blok:** bod
  - **Ostatní:** jiná chyba
- Skóre setu se počítá automaticky. Aplikace pozná konec setu (25 bodů, tie-break 15) a umí vrátit poslední akci.
- Statistiku jde zobrazit za celý zápas i po setech. Body, chyby, +/−, podání, přihrávka, útok s úspěšností a blok. Export: kopírování do Excelu, CSV, tisk do PDF.

## Vývoj

```bash
npm install
npm run dev      # http://localhost:5173 (stahování z cvf.cz jde přes proxy dev serveru)
npm test
```

Všechny balíčky jsou v `devDependencies`, protože je Vite zabalí do výsledného buildu. Windows instalátor tak neobsahuje zbytečné `node_modules`.

## Web / iPad (PWA)

Nasazení na [Netlify](https://www.netlify.com/) (zdarma):

- **Nejrychleji:** `npm run build` a složku `dist` přetáhněte na [app.netlify.com/drop](https://app.netlify.com/drop).
- **Trvale:** propojte GitHub repozitář a každá změna se nasadí sama (nastavení je v `netlify.toml`).

Soubor `public/_redirects` zařídí, že Netlify funguje jako proxy `/cvf/*` → `www.cvf.cz`. Prohlížeč totiž nesmí volat cvf.cz napřímo (CORS).

Při jiném hostingu nastavte při buildu proměnnou `VITE_CVF_PROXY` na adresu vlastní proxy.

**Instalace na iPad:** otevřete web v Safari → Sdílet → Přidat na plochu. Aplikace se pak spouští přes celou obrazovku a data zůstávají uložená v zařízení.

## Android (Google Play)

Build běží v GitHub Actions (`.github/workflows/android.yml`). Spustí se ručně (Actions → Android → Run workflow) nebo pushnutím tagu `v1.0.0`. Výstupem je testovací APK, a pokud je nastavený podpisový klíč, také podepsaný AAB pro Google Play.

Jednorázové nastavení:

1. Vytvořte podpisový klíč a dobře ho uschovejte. Bez něj už aplikaci na Google Play neaktualizujete.
   ```bash
   keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias statistika
   base64 -w0 release.jks   # výstup vložte do secretu ANDROID_KEYSTORE_BASE64
   ```
2. V GitHubu (Settings → Secrets and variables → Actions) přidejte secrety `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` a `ANDROID_KEY_PASSWORD`.
3. V [Google Play Console](https://play.google.com/console) (jednorázový poplatek 25 USD) založte aplikaci a nahrajte AAB.

Lokálně (vyžaduje Android Studio): `npm run android:sync && npx cap open android`.

## Windows (.exe)

Build běží v GitHub Actions (`.github/workflows/windows.yml`) a vytvoří instalátor i přenosnou verzi `.exe`. Lokálně na Windows stačí `npm run electron:build`, výsledek je ve složce `release/`.

## Struktura

| Soubor | Účel |
| --- | --- |
| `src/stats.ts` | Akce, skóre setů, výpočet statistik |
| `src/cvf.ts` | Stažení a zpracování družstev a soupisek z cvf.cz |
| `src/storage.ts` | Ukládání zápasů a soupisek do zařízení |
| `src/screens/` | Obrazovky: seznam zápasů, nový zápas, záznam, statistika |
| `electron/` | Windows aplikace (stahování z cvf.cz přes hlavní proces) |
| `android/` | Android projekt (Capacitor) |
