# CLAUDE.md

This is a **learning project**: the user is a beginner learning React and documents
their learning process in the `docs/` folder. Treat documentation as a first-class
deliverable, not an afterthought.

## Documentation instructions

### When to write docs

- When asked for "docs for my current changes" (or "staged changes"), document the
  git changes in question — run `git status` / `git diff` first and read the actual
  code. Never document from memory or assumption; the docs must match what the code
  really does *right now* (the user sometimes edits files after a discussion).
- "Staged changes" means `git diff --cached` only — leave unstaged/untracked work
  for a future entry.

### Where docs live

- One numbered Markdown entry per learning session/topic: `docs/NN-short-kebab-title.md`
  (e.g. `04-api-layer-react-query-and-mock-server.md`).
- After adding an entry, add a row to the table in `docs/README.md` (number, linked
  title, date). Never put entry content in the README — it is only an index.
- If a batch of changes covers two clearly distinct topics (e.g. routing vs. state),
  split it into two entries rather than one giant mixed one.

### Voice and style

Write **as the learner, in first person** ("I set out to...", "this tripped me up") —
these are the user's learning notes, not a technical manual. Detailed, warm, and
humanly; plain language a beginner can follow.

- Explain the **why**, not just the what. Anyone can copy code; the reasoning is the
  learning. Every code block gets a plain-language walkthrough.
- Define jargon inline the first time it appears (barrel file, controlled input,
  interceptor, CORS, middleware...), ideally with an analogy ("beforeLoad is like a
  bouncer at a club").
- Use real code from the repo in snippets, trimmed to the relevant part — not
  idealized versions.
- Connect new concepts back to earlier entries when they rhyme (e.g. immutable
  updates in Express mirror React state updates from entry 03; server `requireAuth`
  mirrors the router's `beforeLoad` from entry 01).
- Anticipate the beginner's "wait, why?" questions and answer them explicitly
  ("But how does it know /products/add isn't a product ID?").
- Tables for enumerable facts (route → URL mappings, endpoints, status codes);
  prose for explanations.

### Required structure for each entry

1. `# NN — Title`, then `**Date:** YYYY-MM-DD`
2. **"What I set out to do"** — the goal in plain words, as a short list if multi-part
3. Numbered/titled parts walking through the work in build order
4. **"Things that tripped me up / notes to self"** — pitfalls, gotchas, and any known
   weak spots deliberately left in the code (flag those with ⚠️)
5. **"What's next"** — a `- [ ]` checklist of natural follow-ups

### Documenting mistakes (important)

If the user hit a real bug during the session (asked "what's wrong", got a TypeScript
error, etc.), include it in the entry as a `🐛 Bug I hit` section showing the
`❌ WRONG — my first attempt` code, why it fails, and the `✅ RIGHT` fix. The user
considers documented mistakes the most valuable part of the journal — do not sanitize
them away.

### Accuracy over flattery

If the changes contain a genuine problem (missing dependency, inconsistent status
codes, known bug), say so in the notes/next-steps sections instead of glossing over
it — and mention it in the chat reply too.

## Project conventions worth knowing

- Feature-based structure: UI lives in `src/features/<feature>/` with a barrel
  `index.ts`; route files in `src/routes/` stay thin and just point at feature
  components. `src/routeTree.gen.ts` is generated — never edit it.
- Path alias `@` = `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`).
- Mock backend: `npm run mock-api` runs `mock-server/server.js` (Express, port 3000,
  in-memory data, seeded login `sandip@example.com` / `password123`). Protected
  routes return **403** for a missing/invalid token, and the axios response
  interceptor redirects to `/login` on 403 — keep the two in sync if either changes.
