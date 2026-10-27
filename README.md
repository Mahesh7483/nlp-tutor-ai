# NLP Tutor AI

An AI-powered study chatbot for **NLP Engineering** students: concept explanations with worked
examples and Python code, streaming markdown answers, quiz practice, a searchable glossary, a
learning roadmap with saved progress, curated code examples, and question-answering over your own
uploaded course notes with page citations.

It works out of the box in a clearly-labelled **demo mode** (no credentials needed) and switches to
live answers from any OpenAI-compatible chat-completions provider with three environment variables.

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
│       ├── services/              # aiProvider.ts, tutorPrompt.ts, demoEngine.ts, docStore.ts
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
   backend reports live configuration, and stays **Demo mode** (amber) otherwise. The backend never
   fakes a "Connected" state: chat errors (bad key → 401, wrong model → 404, timeouts) surface as
   inline error boxes with a Retry button.

Keys live only in `server/.env` (git-ignored) and are never sent to the browser.

## Features

- **Streaming tutor chat** with markdown, tables, KaTeX math, syntax-highlighted code blocks with
  copy buttons, stop-generation, regenerate, per-answer copy, error boxes with retry.
- **Specialized tutoring** via a dedicated system prompt (definition → intuition → steps → example →
  code → expected output → pros/cons → exam notes → practice question), honest about uncertainty,
  never claims code was executed, keeps recent conversation context for follow-ups.
- **Quiz Practice** — topic + difficulty (+ mixed) selection, 4 options per question, reveal answer
  and explanation after submit, score summary, recent-round stats; live AI generation when
  configured with automatic fallback to a 40-question built-in bank (labelled honestly either way).
- **NLP Glossary** — 40+ searchable terms with definitions, examples and "Ask tutor" deep-dive jump.
- **Code Learning** — curated Python examples (NLTK, spaCy, scikit-learn, Transformers, PyTorch,
  gensim) with install commands, sample inputs and approximate outputs (clearly not claimed executed).
- **Learning roadmap** — 8-stage path with prerequisites and locally-saved progress checkboxes.
- **Course documents** — upload PDF (text-layer) or plain text, per-page extraction with page
  references, keyword-grounded answers citing "(Notes, p.N)", explicit separation of notes content
  from general knowledge, informative errors for unsupported/empty/oversized/unreadable files.
- **Chat history** — create, rename, delete, searched-by-title-and-content, stored in localStorage
  with defensive parsing for corrupted data.
- **Light/dark/system theme**, responsive desktop sidebar + mobile drawer, accessible labels and
  keyboard behavior (Enter to send, Shift+Enter newline, Escape closes dialogs, stop button).

## Testing & verification performed

All of the following were actually run during development on this machine:

- `tsc --noEmit` for server and client — clean.
- Server unit tests (`npm test` in `server/`) — **7/7 pass**: quiz bank integrity/sampling and
  chunk/grounding retrieval behaviour.
- Vite production build — clean (bundle split into index/markdown/katex chunks).
- API tests against the running backend (demo mode, no credentials):
  - `GET /api/health` → `{ mode: "demo", requires: [...] }`
  - `POST /api/chat` (demo) → full SSE stream ending `{"type":"done"}` (lesson streamed, ~7.6 kB)
  - empty message → HTTP 400 with validation message; >8000-char message → HTTP 400
  - chat for a non-existent docId → HTTP 404 with a re-upload hint
  - grounded doc question (txt and 2-page PDF) → excerpts cited `[Notes p.1]` / `[Notes p.2]`
  - `POST /api/documents` txt + PDF (201, pages/chars extracted), unsupported type → 415 with message
  - `POST /api/quiz` → filtered questions from the built-in bank (`source: "built-in"`)
- Browser smoke tests (desktop viewport + narrow layout): welcome screen, sending and streaming a
  demo lesson, regenerate, stop mid-stream (partial text kept), theme toggle (+ persistence),
  chat create/rename/delete, quiz generate→answer→submit (score + explanations + stats), glossary
  search + ask-tutor jump, document upload via page fetch → attach → grounded answer with page tag,
  roadmap checkbox persistence, settings page.

**Not verified without credentials (requires an API key):** live-provider chat streaming, live quiz
generation, provider failure handling (401/404/429/timeout) beyond the code paths — the mapping and
error surfacing are implemented and unit-testable, but the end-to-end behaviour needs real
credentials. Manual cross-browser/responsive checks (other browsers, physical mobile devices) were
not performed.

## Scope & limitations (be aware)

- Demo mode: the tutor's offline engine contains a handful of complete sample lessons
  (tokenization, TF-IDF, stemming/lemmatization, attention/transformers, embeddings, RNN/LSTM,
  BERT/GPT/LLM+RAG, evaluation metrics, VADER/transformer sentiment code, exam-prep sheet). It
  cannot compose arbitrary new explanations — it says so and shows setup instructions.
- Document QA is **keyword retrieval over extracted text** (chunks capped, ≤10 docs kept, documents
  live in server memory and disappear on restart). This is *not* an embeddings/vector-database RAG
  pipeline; the UI and answers never claim otherwise. The layout is ready to add embedding-based
  retrieval later.
- Chat history is per-browser localStorage; clearing browser data removes it.
- Extraction requires PDFs with a text layer (scans are rejected with helpful errors).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Banner "Could not reach the backend" | Start it: `npm run dev:server` (or `cd server && npm run dev`). |
| Status pill says Demo mode but you want live answers | The three `AI_*` variables are not set in `server/.env`, or the server wasn't restarted after editing it. |
| 401 / 403 in an error box | API key rejected/insufficient for that model — check `AI_API_KEY`. |
| 404 in an error box | Wrong `AI_BASE_URL` or `AI_MODEL` (e.g. non-chat model). |
| "Document no longer available" | Server restarted (in-memory store). Re-upload from the Documents page. |
| PDF upload says no readable text | It's a scan or image-only PDF — the text layer is required. |
| Quiz always says "built-in bank" | Live generation needs configured credentials or the provider call failed; it falls back automatically. |

## Notes on course material

The 20-topic list is a default learning scope, **not** a claim about any specific syllabus. Uploaded
notes always take priority, and the tutor clearly states when it lacks course-specific information
instead of inventing it.
