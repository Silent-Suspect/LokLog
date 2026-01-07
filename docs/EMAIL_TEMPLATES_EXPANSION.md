# Email Templates Expansion (Session Summary)

**Date:** 2024
**Feature:** Expanded Email Templates
**Module:** `src/modules/EmailTemplates/EmailTemplates.jsx`

## Overview
This session focused on significantly expanding the capabilities of the Email Templates module in LokLog. The goal was to move beyond simple "Start/End" shift notifications and support complex administrative workflows like Roster Confirmation and Timesheet submission.

## Key Features Implemented

### 1. Customizable "Briefkopf" (Header)
*   **Previous Behavior:** Hardcoded concatenation of user profile fields.
*   **New Behavior:** Fully customizable template string accessible in the "Settings" tab.
*   **Placeholders:** `[Vorname]`, `[Nachname]`, `[Strasse]`, `[PLZ]`, `[Ort]`, `[Festnetz]`, `[Mobil]`, `[Email]`.
*   **Benefit:** Users can format their email signature/header exactly as they wish.

### 2. New Template: "Dienstplan bestätigen" (Roster)
*   **Purpose:** Quickly confirm the current duty roster.
*   **Recipient:** Fixed to `personalplanung-dtf@dispotf.de`.
*   **Subject:** Fixed to `Re: aktueller Dienstplan - BITTE BESTÄTIGEN!`.
*   **Dynamic Greeting:**
    *   Default: Time-based (Guten Morgen/Tag/Abend).
    *   Override: Users can enter a recipient name (e.g., "André") in the modal to generate `Hallo André`.

### 3. New Template: "Stundenzettel" (Timesheet)
*   **Purpose:** Submit travel reports and timesheets.
*   **Recipient:** Fixed to `stundenzettel@dispotf.de`.
*   **Dynamic Subject Line:**
    *   Auto-detects singular (`Fahrtbericht`) vs. plural (`Fahrtberichte`) based on date range.
    *   Appends context suffix: `, Anreise`, `, Abreise`, or `, An- und Abreise`.
    *   Example: `Fahrtberichte 06.01. - 08.01., An- und Abreise`
*   **Complex Logic:**
    *   **Date Formatting:** Uses `DD.MM.` (2-digit, no year) for the body text to match German administrative preferences.
    *   **Travel Blocks:** Users can toggle "Anreise" and "Abreise" independently.
    *   **Spacing:** Smart logic ensures correct spacing (single blank line) between blocks if both are checked.
    *   **Grammar:** Automatically switches intro text ("anbei mein Fahrtbericht..." vs "meine Fahrtberichte...").
    *   **Midnight Crossing:** Automatically detects if the travel end time is smaller than the start time (crossing midnight) and appends `(+1 Tag)` to the template.

### 4. UI/UX Improvements
*   **Dashboard:** Added new selection cards for Roster and Timesheet.
*   **Settings:** Added editors for the new templates and the global header.
*   **Clear Entries:** Added a button to reset the complex Stundenzettel form to defaults.
*   **Clipboard:** Disabled automatic clipboard copy to prevent unwanted side effects.

## Technical Details
*   **State Management:** `templateData` expanded to hold specific fields for Roster name and Travel details (Start/End/Time/Date).
*   **Logic:** `generateMailto` refactored to handle template-specific recipients and subject line generation logic.
*   **Formatting:** Leveraged `toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })` for precise date output.

## Future Considerations
*   The "Briefkopf" logic is now decoupled and can be reused for future templates easily.
*   The `processTravel` helper function is extensible if more travel types (e.g., "Hotel") are needed.
