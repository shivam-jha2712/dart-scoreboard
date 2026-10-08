# THROW V13

V13 restores the complete Classic Darts throw interface while keeping the realistic board.

## Dart entry behavior
- Typing is a draft only.
- No dart is rendered while a number is being typed.
- Press the green/check button for an individual dart to commit it and plant exactly one dart.
- Press Enter to commit the active dart.
- Press Add round to commit any remaining typed darts and score the round.
- Clicking a scoring area on the board is an explicit complete dart and plants it immediately.
- Valid single-dart scores are enforced, including values such as 22 (D11), 33 (T11), 25 and 50.
- Scores above the remaining total bust; an exact zero wins under the current Straight Out rules.

Firebase config and Realtime Database rules are preserved from V12.


V14 fixes the missing draftThrows state that prevented the darts throw panel from initializing correctly. The throw UI is now always visible, and typed scores are committed only when the user presses the dart checkmark/Enter or Add round.
