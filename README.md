# NLP Tutor AI

An AI-powered study chatbot for **NLP Engineering** students: concept explanations with worked
examples and Python code, streaming markdown answers, quiz practice, a searchable glossary, a
learning roadmap with saved progress, curated code examples, and question-answering over your own
uploaded course notes with page citations.

It works out of the box in a clearly-labelled **offline tutor mode** — a built-in conversational NLP
engine (topic knowledge base + answer composer) that needs **no API key at all** — and optionally
switches to live answers from any OpenAI-compatible chat-completions provider with three environment
variables.

---

## Tech stack

| Layer     | Choice                                                              |
|-----------|---------------------------------------------------------------------|
| Frontend  | React 19 + TypeScript + Vite, Tailwind CSS v4, lucide-react icons   |
| Backend   | Node.js + Express 5 + TypeScript (ESM)                              |
| AI        | Fetch-based OpenAI-compatible `POST {AI_BASE_URL}/chat/completions` with SSE streaming |
| Documents | `unpdf` (PDF text extraction, page-level) + plain-text handling     |
| Persistence| Browser `localStorage` (chats, theme, roadmap, quiz stats); documents kept in server memory |

## Project structure

```
nlp-tutor-ai/
├── client/                        # React frontend
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── App.tsx                # shell: layout, routing by view, health polling
│   │   ├── main.tsx / index.css   # entry + Tailwind/markdown/katex styles (light & dark)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx        # logo, new chat, search, history rename/delete, tool nav
│   │   │   ├── Header.tsx         # title, provider status pill, theme toggle, clear chat
│   │   │   ├── ChatView.tsx       # streaming orchestration, docs attach, clear/confirm
│   │   │   ├── Composer.tsx       # autosizing input, Enter/Shift+Enter, stop, upload chip
│   │   │   ├── MessageBubble.tsx / Welcome.tsx / Markdown.tsx (code copy blocks)
│   │   │   └── Modal.tsx (ConfirmDialog)
│   │   ├── pages/                 # Quiz | Glossary | Roadmap | Code Examples | Documents | Settings
│   │   ├── lib/                   # api.ts (SSE client), storage.ts, useChatStore.ts, theme.ts
│   │   ├── data/                  # glossary.ts, roadmap.ts, topics.ts, codeExamples.ts
│   │   └── types/
│   └── vite.config.ts             # /api proxy → localhost:8787
├── server/
│   └── src/
│       ├── index.ts               # app bootstrap + optional static serving of client/dist
│       ├── env.ts                 # config + aiStatus (secret-free)
│       ├── routes/                # health.ts, chat.ts (SSE), documents.ts, quiz.ts
│       ├── services/              # offlineTutor.ts (intents + composers), knowledge.ts (20 topic
│       │                          # cards), aiProvider.ts, tutorPrompt.ts, docStore.ts
│       ├── demos/quizBank.ts      # offline MCQ bank (+ tests)
│       └── middleware/validation.ts
├── samples/                       # sample-nlp-notes.txt / .pdf for testing document upload
├── package.json                   # root convenience scripts
└── .gitignore                     # .env / node_modules / dist excluded
```

## Quick start

Requires Node.js ≥ 20 (built with Node 26). Three terminals:

```bash
# 1) backend
cd server
npm install
npm run dev                # http://localhost:8787  (starts in DEMO mode without credentials)

# 2) frontend
cd client
npm install
npm run dev                # http://localhost:5173  (proxies /api to 8787)

# or from the repo root:
npm run dev:server
npm run dev:client
```

Open **http://localhost:5173**.

### Production-style single port

```bash
npm run build              # builds server/dist + client/dist
cd server && npm start     # serves API + built frontend on http://localhost:8787
```

## Enabling live AI answers

1. Copy `server/.env.example` → `server/.env`.
2. Fill in your provider details:

```dotenv
AI_API_KEY=sk-your-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

- `AI_BASE_URL` — root of an OpenAI-compatible chat-completions API (no trailing slash).
  Works with OpenAI, OpenRouter, Groq, Together, LM Studio, Ollama (`http://localhost:11434/v1`,
  choose a chat model), and similar gateways.
- `AI_MODEL` — the **provider's real model id**. The app never assumes which model writes code;
  the deployed runtime model is whatever you set here.
- `PORT`, `MAX_MESSAGE_CHARS` (8000), `AI_TIMEOUT_MS` (120000), `MAX_DOC_CHARS` (400000) are optional.

3. Restart `npm run dev:server`. The header pill shows **Live · model-name** (green) when the
   backend reports live configuration, and stays **Offline tutor** (amber) otherwise. The backend never
   fakes a "Connected" state: chat errors (bad key → 401, wrong model → 404, timeouts) surface as
   inline error boxes with a Retry button.

Keys live only in `server/.env` (git-ignored) and are never sent to the browser.

## Features

- **Real chatbot feel — fully offline, no API.** A rule-based tutor engine (`offlineTutor.ts` +
  a 20-topic `knowledge.ts`) handles greetings, small talk, "what can you do", topic lessons,
  comparison requests, code asks, exam prep and practice questions with human-like streaming pacing
  (thinking pause → jittered chunks → paragraph slowdowns). Honest when it doesn't know something
  instead of inventing an answer.
- **Behavioural engagement** — greetings vary by time of day, welcome you back by name ("my name
  is Rahul") and resume the last discussed topic; the tutor asks you questions back ("how's your
  prep going?"), reads mood replies ("i'm feeling stressed today" gets support + easier options),
  and says a proper goodbye. Every reply carries an intent tag, so follow-up chips adapt:
  explorer chips ("What topics do you cover?", "How should I start learning NLP?") under
  conversational answers, topic chips (code / deepen / practice) under lessons.
- **Conversational memory of the topic** — "explain it more deeply", "show me the Python code",
  "ask me a practice question", "show answer" one-click chips (and typed phrasings) resolve against
  the last discussed topic per chat. Every session starts with a one-time offline banner, not one
  per message.
- **Catching human-style questions** — message normalization (punctuation/dashes), paraphrase
  fragments ("tf idf", "bag of words") and typo-tolerant fuzzy matching ("explian tokanisation",
  "difrence between stemming and lemmatization") so misspelled or loosely-phrased questions still
  land on the right lesson; glossary definitions and study-planning asks route to the Glossary /
  Roadmap views, while concrete topics still win over the pointers.
- **Topic knowledge base** — 20 NLP topic cards (intro, preprocessing/Unicode, tokenization, regex,
  stopwords, stemming/lemmatization, n-gram LMs, POS, NER, parsing, syntax/semantics/discourse,
  BoW/TF-IDF, embeddings, classification/sentiment, MT/summarization/QA, RNN/LSTM, attention/
  Transformers, BERT/GPT, LLMs/prompting/RAG, evaluation metrics, responsible AI) each with
  intuition, steps, worked example, pros/cons, common mistakes and exam notes; 8 curated comparison
  tables (BERT vs GPT, stemming vs lemmatization, RNN vs Transformer, precision vs recall …).
- **Streaming tutor chat** with markdown, tables, KaTeX math, syntax-highlighted code blocks with
  copy buttons, stop-generation, regenerate, per-answer copy, error boxes with retry.
- **Specialized tutoring** (live mode) via a dedicated system prompt (definition → intuition →
  steps → example → code → expected output → pros/cons → exam notes → practice question), honest
  about uncertainty, never claims code was executed, keeps recent conversation context.
- **Quiz Practice** — topic + difficulty (+ mixed) selection, 4 options per question, reveal answer
  and explanation after submit, score summary, recent-round stats; live AI generation when
  configured with automatic fallback to a 40-question built-in bank (labelled honestly either way).
- **NLP Glossary** — 40+ searchable terms with definitions, examples and "Ask tutor" deep-dive jump.
- **Code Learning** — curated Python examples (NLTK, spaCy, scikit-learn, Transformers, PyTorch,
  gensim) with install commands, sample inputs and approximate outputs (clearly not claimed executed).
- **Learning roadmap** — 8-stage path with prerequisites and locally-saved progress checkboxes.
- **Course documents** — upload PDF (text-layer) or plain text, per-page extraction with page
  references, keyword-grounded answers citing "[Notes p.N]" (offline mode quotes retrieved passages
  verbatim and says exactly what a live provider would add), informative errors for
  unsupported/empty/oversized/unreadable files.
- **Chat history** — create, rename, delete, searched-by-title-and-content, stored in localStorage
  with defensive parsing for corrupted data.
- **Light/dark/system theme**, responsive desktop sidebar + mobile drawer, accessible labels and
  keyboard behavior (Enter to send, Shift+Enter newline, Escape closes dialogs, stop button).

## Testing & verification performed

All of the following were actually run during development on this machine:

- `tsc --noEmit` for server and client — clean.
- Server unit tests (`npm test` in `server/`) — **26/26 pass**: quiz bank integrity/sampling,
  chunk/grounding retrieval behaviour, and a dedicated offline-engine suite (knowledge-base integrity,
  greetings, lessons, per-chat follow-up memory, comparison tables, practice→reveal loop, exam sheets,
  quiz routing, honest bounding of scope, one-per-chat banner, typo/paraphrase catching, glossary +
  roadmap routing, fresh/returning/name/mood/goodbye behavioural conversation).
- Vite production build — clean (bundle split into index/markdown/katex chunks).
- API tests against the running backend (offline mode, no credentials):
  - `GET /api/health` → `{ mode: "demo", requires: [...] }` (demo/offline protocol value kept for compatibility)
  - `POST /api/chat` → full SSE stream ending `{"type":"done"}`; a 23-scenario battery covering
    greetings, quick vs deep lessons (+code), follow-ups via chat memory, curated comparison tables,
    code answers, exam prep, simplify, quiz routing, thanks/smalltalk, yes/no continuations,
    off-topic refusal, unknown-topic honesty, and the offline banner appearing only on the first
    message of a chat — plus a 9-case catch battery (typo'd questions → full lessons, spaced
    "tf idf", typo'd comparisons → curated table, roadmap/glossary routing, unchanged honest
    refusal for truly out-of-scope asks) and a 10-case intent battery (greeting/returning/name/
    mood/goodbye/conversation/lesson/compare intents riding on the `done` SSE event).
  - empty message → HTTP 400 with validation message; >8000-char message → HTTP 400
  - chat for a non-existent docId → HTTP 404 with a re-upload hint
  - grounded doc question (txt and 2-page PDF) → excerpts cited `[Notes p.1]` / `[Notes p.2]`
  - `POST /api/documents` txt + PDF (201, pages/chars extracted), unsupported type → 415 with message
  - `POST /api/quiz` → filtered questions from the built-in bank (`source: "built-in"`)
- Found and fixed during browser testing: chats longer than **30 messages** triggered HTTP 400 on
  every new send (the server validates history length; the client kept sending the full history),
  which showed up as silently empty bubbles. The client now trims sent history to 30 and error text
  is recorded on the message reliably.
- Browser smoke tests (desktop viewport + narrow layout): welcome screen, streaming answers with the
  offline banner + "offline" message tag, sending via the follow-up chips (practice → show answer;  code; deep lesson — all verifying rendered content, syntax-highlighted code with correct text), 
  header "Offline tutor" pill, regenerate, stop mid-stream (partial text kept, "generation stopped"
  marker), theme toggle (+ persistence), chat create/rename/delete, quiz generate→answer→submit,
  glossary search + ask-tutor jump, document upload → attach → grounded answer with page tags,
  roadmap checkbox persistence, settings page, mobile drawer open/close.

**Not verified without credentials (requires an API key):** live-provider chat streaming, live quiz
generation, provider failure handling (401/404/429/timeout) beyond the code paths — the mapping and
error surfacing are implemented and unit-testable, but the end-to-end behaviour needs real
credentials. Manual cross-browser/responsive checks (other browsers, physical mobile devices) were
not performed.

## Scope & limitations (be aware)

- **Offline tutor mode is rule-based, not an LLM.** It matches questions against a curated NLP
  knowledge base (20 topic cards) and composes structured answers from them. It handles follow-up
  phrasings and modifiers, but unfamiliar topics get an honest "I don't have a built-in lesson for
  that" plus closest matches — never fabricated content. Per-chat topic memory lives in server RAM
  and resets when the backend restarts (history sent by the client is used as fallback).
- Document QA is **keyword retrieval over extracted text** (chunks capped, ≤10 docs kept, documents
  live in server memory and disappear on restart). This is *not* an embeddings/vector-database RAG
  pipeline; the UI and answers never claim otherwise. The layout is ready to add embedding-based
  retrieval later.
- The listed Python outputs inside lessons are *indicative* (labelled as such) — nothing is executed
  by the tutoring server.
- Chat history is per-browser localStorage; clearing browser data removes it.
- Extraction requires PDFs with a text layer (scans are rejected with helpful errors).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Banner "Could not reach the backend" | Start it: `npm run dev:server` (or `cd server && npm run dev`). |
| Status pill says Offline tutor but you want live answers | The three `AI_*` variables are not set in `server/.env`, or the server wasn't restarted after editing it. |
| 401 / 403 in an error box | API key rejected/insufficient for that model — check `AI_API_KEY`. |
| 404 in an error box | Wrong `AI_BASE_URL` or `AI_MODEL` (e.g. non-chat model). |
| "Document no longer available" | Server restarted (in-memory store). Re-upload from the Documents page. |
| PDF upload says no readable text | It's a scan or image-only PDF — the text layer is required. |
| Quiz always says "built-in bank" | Live generation needs configured credentials or the provider call failed; it falls back automatically. |

## Notes on course material

The 20-topic list is a default learning scope, **not** a claim about any specific syllabus. Uploaded
notes always take priority, and the tutor clearly states when it lacks course-specific information
instead of inventing it.
