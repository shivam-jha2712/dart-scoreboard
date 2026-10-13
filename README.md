# THROW V20

V20 adds a third, standard numbered Target game while preserving the existing Classic Darts and Baseball modes.

## V20 changes
- Added **Standard Target** as a separate game mode in the main navigation.
- Uses the supplied real target-board photograph as a cleaned, circular, high-resolution board asset.
- Target scoring follows the supplied board: outer ring = 1, moving inward to 9; red bull = 10; a miss = 0.
- Three darts per player per round, with selectable 5 / 10 / 15 round games; highest total wins.
- Target board clicks select a score but **do not plant a dart until that individual dart is committed**.
- Typed target scores accept only 0–10; invalid values are rejected.
- Real photographic red/yellow darts are planted only for committed non-zero scores.
- Target game state is included in the Firebase live-room state so viewers see the same game.
- Classic Darts and Baseball behavior remains intact.
- 0 is treated as a miss for the visual dart layer, so no dart is falsely shown on the board for a miss.
- THROW favicon/header branding remains unchanged.

## Firebase
No Firebase configuration or Realtime Database rules were changed in V20.

## V21 — Tap-to-throw scoring
- Tap the exact landing point on the classic dartboard or baseball dartboard to record the throw and plant a dart at that coordinate.
- Double and triple rings apply the sector multiplier automatically; bull and outer bull score 50 and 25.
- The inner single scoring area is now clickable as well as the outer single area.
- Standard Target taps record the ring score immediately and plant the dart at the tapped point.
- The throw summary updates immediately; once three darts are recorded, additional taps are blocked until the round/inning is submitted.
- Editing a score manually clears that dart's board placement until the score is committed again.
- Improved responsive spacing and touch target sizes for phone, tablet and desktop layouts.
- Firebase configuration and database rules are unchanged from V20.
