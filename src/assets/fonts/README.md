# Fonts

Used by the client PDF (`src/lib/export/pdf.tsx`). Both families cover Latin and Cyrillic.

- `Onest-Regular|Medium|SemiBold.ttf` — Onest by the Onest Project Authors, SIL Open Font License 1.1 (`OFL-Onest.txt`).
- `JetBrainsMono-Regular|Medium.ttf` — JetBrains Mono by JetBrains, SIL Open Font License 1.1 (`OFL-JetBrainsMono.txt`).

Built from the `@fontsource/onest` and `@fontsource/jetbrains-mono` WOFF subsets
(latin, latin-ext, cyrillic, cyrillic-ext) merged into one TTF per weight with fontTools.
