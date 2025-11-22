# Nebula Deckbuilder

This is a lightweight, static web app that consumes the Nebula API to build ULTRAMAN decks with the in-game rules (50 cards max, up to 4 copies of any card).

## Running locally

1) Serve the deckbuilder (from repo root):
```bash
python -m http.server --directory docs 3000
```
2) Open http://localhost:3000/ and ensure the API base URL field matches your API origin if it differs.

## Features

- Browse cards with filters for rarity, type, feature, level/round, character, number, publication year, and errata.
- Text search (name/effect) using the `/search` endpoint.
- Add/remove cards with 4-copy and 50-card limits enforced client-side.
- Deck summary (total + unique), localStorage persistence between sessions, and JSON export/import for sharing decks.
- Export decklist as a PNG image with card art, names, and quantities.

## Notes

- Filter dropdowns are populated from the currently fetched cards (using the card model fields), so options adapt to the visible result set.
- All assets are static—no additional build step or dependencies are required.
- To allow specific cards to exceed the 4-copy limit, edit `cardCopyOverrides` in `app.js` (keyed by card number/id) with the max copies you want to permit.

## Saving and importing decks

- Use **Export JSON** in the Deck panel to download your current list (includes counts and card snapshots).
- Use **Import JSON** to load a previously exported deck; the app will cap copies at 4 and the total at 50.
- Use **Export Image** to download a PNG grid of your current deck (cards + quantities).
