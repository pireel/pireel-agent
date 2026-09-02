# Credits & plans

## What credits are

Credits are Pireel's metered currency for **its own model calls**. They are orthogonal to the subscription plan: plans grant a monthly credit allowance, top-up packs add more on any plan (including Free).

## What charges credits (from the agent)

Only tools explicitly marked `[…CHARGES…]` in their MCP description:

- Hosted media generation: `generate_image`, `generate_video`, `generate_audio`, `generate_speech`, `lip_sync`, and `manage_voices` clone / design (video generation additionally requires the Pro plan or higher).
- Hosted analysis/generation fallbacks such as `apply_component {generate:true}`, `inspect_media` in its `semantic` / `editorial` modes, and `get_transcript` when transcription must actually run — whenever their current tool description carries the charge marker. Geometry-only visual analysis (`inspect_media mode:geometry`) is local and token-free.

**Everything else is free**: import (video + images + audio), transcript-based cutting, captions, themes, clip framing, the BYO `compose_component` / `apply_component` flow, `inspect_timeline` review and local export. The default agent workflow costs the user nothing — prefer BYO routes over charging fallbacks.

## Plans

| | Free | Pro | Max |
|---|---|---|---|
| Price | $0 | $20/mo · $200/yr | $100/mo · $1,000/yr |
| Credits | 20 granted daily | 2,000 per 30-day cycle | 10,000 per 30-day cycle |
| Video generation | — (needs Pro+) | ✓ | ✓ |
| Export resolution | up to 720p | up to 1080p | up to 1080p |
| Model access | standard models | all models | all models |
| Commercial license | — | ✓ | ✓ |

## Top-up packs (work on any plan)

- $10 → 1,000 credits (starter)
- $100 → 11,000 credits (includes 1,000 bonus)
- $500 → 60,000 credits (includes 10,000 bonus)
- Larger packs and current pricing: https://pireel.com/pricing

## Handling "insufficient credits"

A charging tool returns 402 / `insufficient_tokens` with `need` and `balance` when the account can't cover the call. Do: state the shortfall plainly, offer the free BYO alternative when one exists, and link https://pireel.com/pricing for plans/top-ups. Don't: retry the same call, or switch to a different charging tool hoping it's cheaper.
