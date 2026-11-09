# Classification explanations for every future K report

The stock and TAIEX PNGs now explain the three model-close categories immediately
above the existing percentage table. Upper/lower values and 元/點 come from the
same verified statistics object; no price, stock name or business rule is hardcoded.
Above the upper threshold is 偏多, below the lower threshold is 偏空, and both
boundaries are included in 盤整. The three horizons share one band within a report;
a new post-close report calculates its own band from the updated inputs.

Normal and watermarked reports share one renderer. Canvas size remains1284×2778.
Original graph coordinates, pixels, date labels, price labels, source/model
fingerprints, samples, counts, percentages and trading rules remain unchanged.
The lower explanation/planning cards are rearranged to make room for three36px
classification lines. Preview-only labels are removed from production.

Validation compares every current supported model with the previous deployed
renderer, using the same inputs: full chart pixels, all baseline labels/statistics,
both PNG encodings and files, text bounds and shared normal/watermarked wording.
Four DRs remain excluded per user instruction. Genuine model/history limitations
are reported with reasons; they are not turned into invented forecasts.

The deployment workflow tests all four shards and units before publishing, then
checks actual stock/index clean/watermarked downloads and the main market toolbar.
