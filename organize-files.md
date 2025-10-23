## File Organization Task List

The goal is to group browser-only scaffolding away from Defold-targeted runtime code, lining up data and assets with the systems that will own them once ported. Check items off as we move files.

**Execution plan:** work through the list in batches of two to three related items at a time, running the follow-up actions after each batch to keep imports and tooling tidy.

### Defold Runtime Alignment

1. [x] Move `src/config/constants.ts` → `src/defold/config/constants.ts` to keep gameplay tuning under the Defold namespace.
2. [x] Move `src/utils/utils.ts` → `src/defold/shared/utils.ts` so shared helpers live beside the runtime.
3. [x] Move `src/defold/modules/settings_state.ts` → `src/defold/runtime/state/settings_state.ts` with the other state singletons.
4. [x] Move `src/defold/modules/cards.ts` → `src/defold/runtime/controllers/card_stack.ts` (rename) to reflect that it runs live card logic.
5. [x] Move `src/defold/modules/sampleCardsDb.ts` → `src/defold/data/cards/sample_cards.ts` to isolate pure data.
6. [x] Move `src/defold/modules/budget.ts` → `src/defold/runtime/controllers/budget_controller.ts` and split defaults into `src/defold/data/budget/presets.ts`.
7. [x] Move `src/defold/modules/polyomino.ts` → `src/defold/runtime/environment/geometry/polyomino.ts` to sit with environment drawables.
8. [x] Move `src/defold/modules/bitmaps/*` → `src/defold/assets/bitmaps/*` so bitmap patterns are treated as assets.
9. [x] Move `src/defold/modules/trees/*` → `src/defold/assets/trees/*` for the same asset grouping.

### Web Shell Extraction

10. [ ] Move `src/defold/gui/settings_overlay.ts` → `src/web/ui/settings_overlay.ts` to isolate DOM overlay code.
11. [ ] Move `src/defold/gui/notifications.ts` → `src/web/ui/notifications.ts` for DOM-based alerts.
12. [ ] Move `src/defold/gui/starfield.ts` → `src/web/environment/starfield.ts` since it creates a browser canvas background.
13. [ ] Move `src/defold/runtime/state/ui_state.ts` → `src/web/state/ui_state.ts` because it touches DOM elements.
14. [ ] Move `src/defold/runtime/controllers/game_over_controller.ts` → `src/web/ui/game_over_screen.ts` to keep DOM composition outside the runtime.
15. [ ] Move `src/styles/styles.css` → `src/web/styles/game.css` (adjust references) to signal web-only styling.
16. [ ] Move `src/workers/service-worker.ts` → `src/web/workers/service-worker.ts` with other browser artifacts.
17. [ ] Move `src/main.ts` → `src/web/main.ts` and update tooling configs accordingly.

### Follow-up Actions For Each Task

[ ] Update imports after each move so modules point at the new locations.
[ ] Adjust `vite.config.ts` and any tsconfig path aliases once new directories exist.
[ ] Add adapter layers so the Defold runtime can run without DOM globals, smoothing the future Defold/Lua port.
