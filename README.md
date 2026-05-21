# Temps Retrouvé

*"I have this screaming in my head and I must put these neurons into recordable form."*

---

## What it is

A tool that takes private AI conversations — the raw, unfiltered record of a mind working through problems, building things, failing, dreaming — and surfaces them as tweets.

Two goals that need each other:

**The complete record** — everything goes in. The mechanical, the circular, the frustrating, the mundane. This is the ground.

**The journey** — occasional moments where the living becomes understanding. Marked with ★. Searchable at `from:jzrucker ★`.

Without the ground the insights float. Without the insights the ground is just a log file.

---

## Why

The honest answer keeps changing, which probably means all of them are true.

To entertain myself — nothing else does, and making something that does feels like the only real reason to make anything.

To record — 1.7 million words typed into AI in two months, all of it disappearing into dead threads. This recovers that time. Makes it exist somewhere other than a box nobody opens.

To be seen — not performing, not branding, just: this mind exists, here is the evidence.

To understand how I think — the feedback loop of making private thinking public forces clarity. Arguments that survive exposure are real. The ones that don't were noise.

Fearlessness — not as a pose but as a practice. Most of what people hide isn't worth hiding. Putting it out anyway is the point.

And maybe most honestly: the screaming in my head needs somewhere to go. This is somewhere.

---

## Why Twitter

It's the marketplace of ideas that actually exists. This uses the infrastructure for a purpose it wasn't designed for. That tension is fine.

---

## How it works

- Reads exported Claude conversation history (.txt)
- Chunks into batches of ~10 pages
- Generates 17 candidate tweets per batch via Claude API
- Preview → `all` to post everything / `skip` to skip batch / enter to review one by one
- ★ prefixed tweets are voyeur/insight moments — searchable separately
- Posts via X API with OAuth 1.0a
- Progress saved — resume anytime across sessions

---

## Setup

```
npm install
```

Create a `.env` file:

```
ANTHROPIC_API_KEY=your_key
X_CONSUMER_KEY=your_key
X_CONSUMER_SECRET=your_key
X_ACCESS_TOKEN=your_key
X_ACCESS_TOKEN_SECRET=your_key
```

Add your conversation export as `Claude-1.txt` in the project folder. For subsequent files use `Claude-2.txt`, `Claude-3.txt` etc.

```
node index.js
```

---

## The name

Temps Retrouvé — Time Recovered. The final volume of Proust's *In Search of Lost Time*. The time wasn't lost. It just needed recovering.

---

*[@jzrucker](https://x.com/jzrucker)*

