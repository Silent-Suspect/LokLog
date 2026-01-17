# 🚂 LokLog Architektur & AI Regeln

## 1. Tech Stack (Core)
* **Frontend:** React 19, Vite, Tailwind CSS.
* **Local DB:** Dexie.js (IndexedDB wrapper) für Offline-First.
* **Backend:** Cloudflare Pages Functions (Node.js compat) + D1 Database (SQLite).
* **Auth:** Clerk (Token validation im Backend via `clerk-verify.js`).

## 2. Das "Heilige" Daten-Modell (CRITICAL)
Wir nutzen eine **Hybrid-Architektur**. Das Frontend tickt anders als das Backend!

### A. Frontend (Dexie / Local)
* **Storage:** Dokumenten-basiert im Browser.
* **Struktur:** Die Tabelle `shifts` enthält das komplette Schicht-Objekt.
* **Embedding:** `segments`, `guest_rides` und `waiting_times` sind **JSON-Arrays direkt im `shift`-Objekt**.
* **Verbot:** NIEMALS versuchen, im Frontend Join-Queries auf eine `segments`-Tabelle in Dexie zu machen. Wir laden immer das volle Schicht-Objekt.

### B. Backend (Cloudflare D1 / SQL)
* **Storage:** Relational auf dem Server.
* **Struktur:** Es gibt Tabellen `shifts` (Stammdaten) und `segments` (1:n Verknüpfung).
* **Die API (`/api/shifts`) übernimmt das Mapping:**
    * *GET:* Holt Shift + Joint Segments -> Liefert JSON mit embedded Arrays.
    * *PUT:* Zerlegt JSON -> Update Shift + (Delete old Segments & Insert new Segments).

## 3. Coding Regeln für Jules
* **Logik-Trennung:**
    * UI-Komponenten (`src/components`) dürfen keine komplexe Logik enthalten.
    * Berechnungen (z.B. Dauer) gehören in `src/modules/LokLog/hooks/useShiftCalculations.js`.
    * Daten-Fetching/Sync gehört ausschließlich in `src/modules/LokLog/hooks/useShiftSync.js`.
* **Styling:** Tailwind CSS Utility Classes only. Keine `style={{...}}` Tags für Layouts.
* **Sicherheit:** Frontend-Code (`src`) darf niemals direkt auf `env.DB` (D1) zugreifen. Immer über `fetch('/api/...')`.

## 4. Schutzmechanismen
* **Sync-Safety:** Beachte bei Änderungen an der Speicher-Logik immer die `dirty` Flags und `updated_at` ("Last Write Wins").
* **Anti-Nuke:** Lösche im Backend niemals Segmente, nur weil das Frontend ein leeres Array schickt, ohne vorher das `force_clear` Flag zu prüfen.