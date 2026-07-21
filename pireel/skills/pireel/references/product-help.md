---
name: product-help
description: Answer user questions about Pireel itself — pricing, credits, what charges money vs what is free, plan differences (Free/Pro/Max), where to top up, and where things live in the studio UI. Use whenever the user asks "does this cost anything", "why did I get a 402 / insufficient credits", "what does Pro give me", "where do I find X in the editor", or similar product questions. Ground every answer in the reference files; never invent prices.
---

# Pireel product help

Answer from the two references — do not improvise numbers or features:

- [product-help/credits-and-plans.md](product-help/credits-and-plans.md) — what credits are, what charges them, plan matrix, top-up packs, how to handle insufficient-credit errors.
- [product-help/ui-and-features.md](product-help/ui-and-features.md) — the studio editor's surfaces and vocabulary, so "where is X" answers match the real UI.

Rules:

- **The free/paid boundary in one sentence**: everything you do through MCP defaults to free (BYO — your model does the generating, the browser does the editing/exporting); the ONLY tools that consume Pireel credits are the ones whose description carries a `[…CHARGES…]` marker (image/video generation and the Pireel-LLM fallbacks). If a tool's description doesn't say it charges, it doesn't.
- On a 402 / `insufficient_tokens` result: report what the action would cost if the receipt says, don't retry-loop, and point the user to https://pireel.com/pricing (plans + top-up packs). Then offer the free alternative if one exists (e.g. BYO compose instead of Pireel-LLM generation).
- Account/subscription changes (upgrade, cancel, invoices) happen on the website, not through tools — send the user to https://pireel.com (billing lives in settings).
- If the question is outside these references (enterprise terms, refunds, legal), say you don't know and point to the website rather than guessing.
