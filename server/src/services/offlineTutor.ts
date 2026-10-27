/**
 * Offline tutor engine — the "real chatbot without any API".
 *
 * It turns the structured knowledge base (knowledge.ts) into a conversation:
 *  - intent detection (greetings, thanks, comparisons, code requests, exam
 *    prep, practice questions, follow-ups like "explain more deeply"),
 *  - keyword-scored topic matching over the topic cards,
 *  - per-chat memory of the last topic so pronoun follow-ups work,
 *  - markdown composers for each answer style.
 *
 * Everything is rule-based and runs in-process: no network calls, no keys.
 */

import { TOPIC_CARDS, CARD_BY_ID, type TopicCard } from "./knowledge.js";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const FENCE = "```";

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?= |$)/s);
  return m ? m[0] : text;
}

/** Score how strongly a card's keyword regex matches the message. */
function scoreCard(card: TopicCard, text: string): number {
  let re: RegExp;
  try {
    re = new RegExp(card.keywords, "gi");
  } catch {
    return 0;
  }
  const matches = text.match(re);
  if (!matches || matches.length === 0) return 0;
  const distinct = new Set(matches.map((m) => m.toLowerCase()));
  let score = distinct.size * 3 + (matches.length - distinct.size);
  if (matches.some((m) => m.length >= 8)) score += 2; // specific-phrase bonus
  return score;
}

function scoreAll(text: string): Array<{ card: TopicCard; score: number }> {
  return TOPIC_CARDS.map((card) => ({ card, score: scoreCard(card, text) }))
    .sort((a, b) => b.score - a.score);
}

/** A match counts when at least one distinct keyword phrase hits. */
const MATCH_THRESHOLD = 3;

/* ------------------------------------------------------------------ */
/* Per-chat memory: last discussed topic (for pronoun follow-ups)      */
/* ------------------------------------------------------------------ */

const lastTopicByChat = new Map<string, string>();
const MAX_TRACKED_CHATS = 200;

function rememberTopic(chatId: string | undefined, card: TopicCard): void {
  if (!chatId) return;
  lastTopicByChat.delete(chatId); // refresh recency
  lastTopicByChat.set(chatId, card.id);
  if (lastTopicByChat.size > MAX_TRACKED_CHATS) {
    const oldest = lastTopicByChat.keys().next().value;
    if (oldest !== undefined) lastTopicByChat.delete(oldest);
  }
}

function lastTopicId(chatId: string | undefined): string | undefined {
  if (chatId && lastTopicByChat.has(chatId)) return lastTopicByChat.get(chatId);
  return undefined;
}

/** Resolve the last topic: explicit chat memory first, then recent history. */
function resolveLastTopic(
  chatId: string | undefined,
  history: Array<{ role: "user" | "assistant"; content: string }>,
): TopicCard | null {
  const id = lastTopicId(chatId);
  if (id && CARD_BY_ID.has(id)) return CARD_BY_ID.get(id) ?? null;

  // Fallback: score the last few user messages from the sent history.
  const recentUser = history.filter((m) => m.role === "user").slice(-3).reverse();
  for (const msg of recentUser) {
    const ranked = scoreAll(msg.content);
    if (ranked[0] && ranked[0].score >= MATCH_THRESHOLD) return ranked[0].card;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Intent detection                                                    */
/* ------------------------------------------------------------------ */

const RE = {
  greeting:
    /^(hi+|hey+|hello+|yo|sup|namaste|hola|greetings|good\s+(morning|afternoon|evening))\b[\s!,.]*(there)?[\s!,.]*$/i,
  thanks: /\b(thank(s| you|you)|thx|thanks a lot|that helped|really helpful)\b/i,
  capabilities:
    /\bwhat can (you|u) (do|help)|how (can|do) (you|u) help|who (are|r) (you|u)|what are you|your (features|capabilit)/i,
  identity: /\b(are you (chatgpt|gpt|openai|an? ai|a bot|a real|human)|your name|what model|which model|made you|created you)\b/i,
  topicsList:
    /\b(what|which) topics|topics? (can|do) you (teach|cover|know)|list (of )?topics|topic list|what should i (study|learn|revise)|syllabus coverage|what do you know\b/i,
  compare: /\b(vs\.?|versus|differences? between|compare(d)? (to|with|them)?|contrast)\b/i,

  reveal: /\b(reveal|shows?|gives?|tells?)\s+(me\s+)?(the\s+)?answer\b|^(answer|solution)\b|\b(what'?s|whats) the answer\b/i,
  practice:
    /\b(ask me|test me|quiz me|practice (question|questions|problem|problems)|give me (a )?(practice )?question|another question|one more question|a question on)\b/i,
  code: /\b(code|snippet|program|implement|write.*python|python (code|script|example)|code for)\b/i,
  exam: /\b(exam|exams|viva|midsem|semester|marks|important (points|questions|topics)|revision|revise|last minute|crash course)\b/i,
  simple:
    /\b(simplify|simpler|simple(r)? explanation|short(er)?|in brief|brief|tldr|eli5|like i'?m (5|new)|beginner version|summar(y|ize|ise)|quick version)\b/i,
  detail:
    /\b(more deeply|deeper|explain (it |this |that )?(more|further|again)|more detail|elaborat|expand|continue|go on|walk me through|in (more )?depth)\b/i,
  example: /\b(another example|more examples?|real.?world example|one example|use case|where (is|would) (it|this) (used|useful))\b/i,
  quizPage: /\b(generate|create|make|give me).{0,20}\b(quiz|mcqs?)\b|\bmcqs?\b/i,

  deepish: /\b(explain|teach me|step by step|in depth|in detail|detail(ed)?|deep dive|thorough|from scratch|full lesson|everything about)\b/i,

  yes: /^(yes|yeah|yep|yus|ok(ay)?|sure|fine|go( ahead)?|please( do)?|continue|do it)[\s!.]*$/i,
  no: /^(no(p|pe)?|nah|not now|maybe later|nothing|bye|goodbye|see (ya|you)|thats all|that'?s all)[\s!,.]*$/i,

  smalltalk: /\b(how are you|hows it going|what'?s up|tell (me )?a joke|make me laugh|good (bot|job)|well done)\b/i,
  offTopic:
    /\b(write (me )?a (poem|story|essay|song)|sing|weather|recipe|cook|stock (price|market)|movie|netflix|song|cricket|football match|who will win|president of|prime minister|solve my (math|physics) homework|do my (assignment|homework))\b/i,
} as const;

/* ------------------------------------------------------------------ */
/* Curated comparison tables (popular exam contrasts)                  */
/* ------------------------------------------------------------------ */

interface CompareTable {
  keywords: string;
  title: string;
  intro: string;
  rows: Array<[string, string, string]>;
  rule: string;
}

const COMPARE_TABLES: CompareTable[] = [
  {
    keywords: "stemming.{0,20}lemmat|lemmat.{0,20}stemming",
    title: "Stemming vs Lemmatization",
    intro: "Both reduce inflected words to a base form, but with very different precision.",
    rows: [
      ["How it works", "Rule-based suffix chopping ('-ing', '-ed', '-es')", "Dictionary + morphology, guided by POS context"],
      ["Output", "'studies' → 'studi' — may not be a real word", "'was' → 'be', 'better' → 'good' — always a valid word"],
      ["Speed / cost", "Instant, no resources needed", "Slower; needs a lexicon (WordNet) and POS info"],
      ["Failure mode", "Over- and under-stemming ('university'/'universe')", "Unknown words stay unchanged if not in the lexicon"],
    ],
    rule: "Search/IR and quick baselines → stem (speed wins). Chatbots, translation, linguistic analysis → lemmatize (precision wins). Modern subword transformers make both optional.",
  },
  {
    keywords: "bag of words.{0,20}tf-?idf|tf-?idf.{0,20}bag of words|\\bbow\\b.{0,15}tf-?idf",
    title: "Bag of Words vs TF-IDF",
    intro: "TF-IDF is Bag of Words with smarter weighting — same sparsity, better signal.",
    rows: [
      ["Core value", "Raw count of each vocabulary word per document", "tf × idf: in-document frequency scaled by corpus rarity"],
      ["Common words", "'the', 'is' get heavy weights — pure noise", "High document frequency → idf drives their weight to ~0"],
      ["Best for", "Tiny corpora, count-based features, teaching", "Search ranking, keyword extraction, linear classifiers"],
    ],
    rule: "Default to TF-IDF for anything retrieval- or classification-shaped; plain BoW mainly to understand the idea.",
  },
  {
    keywords: "word2vec.{0,20}glove|glove.{0,20}word2vec",
    title: "Word2Vec vs GloVe",
    intro: "Two classic ways of learning static vectors — local windows vs global statistics.",
    rows: [
      ["Training signal", "Predict context words from a center word (Skip-gram) or vice versa (CBOW)", "Factorize the global co-occurrence matrix of the whole corpus"],
      ["Statistics used", "Local sliding windows, one pair at a time", "Corpus-wide counts, weighted by distance"],
      ["Best when", "Very large corpora, incremental training", "Smaller corpora with reliable global counts"],
    ],
    rule: "Both give ONE vector per word (no disambiguation). For 'bank' the river vs finance problem, move to contextual embeddings (BERT).",
  },
  {
    keywords: "\\brnn\\b.{0,25}transformer|transformer.{0,25}\\brnn\\b|\\blstm\\b.{0,25}transformer|transformer.{0,25}\\blstm\\b",
    title: "RNN/LSTM vs Transformer",
    intro: "The architectural handover of the last decade.",
    rows: [
      ["Processing", "Sequence step-by-step, state carried forward", "Whole sequence in parallel — GPU-friendly"],
      ["Long-range deps", "Gradients fade over many steps; gates mitigate", "Direct attention between any two positions"],
      ["Cost shape", "O(T) steps but sequential (slow wall-clock)", "O(T²) attention compute, massively parallel"],
      ["Training memory", "Must store all hidden states anyway", "KV-cache at inference; larger models"],
    ],
    rule: "Teach and interpret with the classic RNN/LSTM story; build real understanding/generation systems on Transformers (or tiny GRUs on edge devices for streaming).",
  },
  {
    keywords: "\\bbert\\b.{0,25}\\bgpt\\b|\\bgpt\\b.{0,25}\\bbert\\b",
    title: "BERT vs GPT",
    intro: "Encoder and decoder pretraining — two philosophies of the same Transformer block.",
    rows: [
      ["Pretraining task", "Masked Language Modeling — sees both sides of a word", "Causal LM — predicts the next token only"],
      ["Context direction", "Bidirectional", "Left-to-right (causal mask)"],
      ["Excels at", "Classification, NER, extractive QA (understanding)", "Generation: chat, drafting, summarizing"],
      ["Typical output", "A [CLS] vector or per-token labels", "New text, one token at a time"],
    ],
    rule: "Understanding → BERT-family. Generating text → GPT-family. Fine-tune BERT heads with small labelled sets; steer GPT-style models with prompts.",
  },
  {
    keywords: "precision.{0,20}recall|recall.{0,20}precision",
    title: "Precision vs Recall",
    intro: "The two halves of the confusion matrix — optimizing one usually costs the other.",
    rows: [
      ["Optimistic about", "False alarms (FP) — how trustworthy are its positives?", "Misses (FN) — did it catch every true case?"],
      ["Formula", "TP / (TP + FP)", "TP / (TP + FN)"],
      ["Favour it when", "False alarms are costly: spam filters, auto-moderation", "Missing a case is costly: disease screening, fraud detection"],
    ],
    rule: "Report F1 for balance (and macro/weighted averages for multiclass). Read thresholds: raising them raises precision, lowers recall.",
  },
  {
    keywords: "extractive.{0,20}abstractive|abstractive.{0,20}extractive",
    title: "Extractive vs Abstractive summarization",
    intro: "Copy-and-select versus read-and-retell.",
    rows: [
      ["Method", "Selects existing sentences/spans from the source", "Generates brand-new sentences (BART, T5, LLMs)"],
      ["Faithfulness", "Cannot invent facts — safe by construction", "Can hallucinate — verify before trusting"],
      ["Readability", "Choppy, may repeat or miss the flow", "Fluent, compressed, coherent"],
    ],
    rule: "Legal/medical/high-stakes → extractive or human-reviewed abstractive. Casual digests and headlines → abstractive with spot checks.",
  },
  {
    keywords: "n-?gram.{0,25}(neural|transformer|embed)|statistical.{0,15}language model.{0,25}neural",
    title: "N-gram (statistical) LM vs Neural LM",
    intro: "Count tables versus learned dense representations.",
    rows: [
      ["Representation", "Discrete counts of word sequences", "Continuous embeddings of words and states"],
      ["Sparsity", "Zero-count problem — unseen n-grams get 0", "Generalizes: similar words share statistical strength"],
      ["Long context", "Fixed small window (n = 2–5)", "Attention over the whole context window"],
      ["Cost", "Tiny, CPU, no training pipeline", "Billions of parameters, GPUs"],
    ],
    rule: "N-grams stay the exam-friendly baseline (perplexity!); neural LMs define modern quality.",
  },
  {
    keywords: "syntax.{0,25}semantics|semantics.{0,25}syntax",
    title: "Syntax vs Semantics",
    intro: "Structure versus meaning — different levels, different tools.",
    rows: [
      ["Question answered", "Is this grammatical? What attaches to what?", "What does it mean? When is it true?"],
      ["Representations", "Phrase-structure trees, dependency links", "Word senses, semantic roles, logic forms"],
      ["Typical failure", "Parses nonsense ('Colorless green ideas…')", "Knows grammar but misses reference and ambiguity"],
    ],
    rule: "Parsers fix structure, WSD and semantic roles fix meaning, discourse adds cross-sentence context — most 'the model is dumb' bugs are actually one of these three.",
  },
];

/* ------------------------------------------------------------------ */
/* Practice solutions (for the "show answer" follow-up)                */
/* ------------------------------------------------------------------ */

const PRACTICE_SOLUTIONS: Record<string, string> = {
  intro: "The feature/representation stage: 'running' and 'runners' are different surface forms, so a naive keyword index misses. Stemming/lemmatization merges the forms, and embeddings would additionally bridge 'shoes'–'sneakers' semantically.",
  preprocessing: "'ï»¿' is the UTF-8 BOM (bytes EF BB BF) mis-decoded as Latin-1 text. Fix: open/read with encoding='utf-8-sig', or strip U+FEFF after decoding.",
  tokenization: "Word level: 'UNESCO', '%', 'renormalizing', '??'. WordPiece would likely keep 'UNESCO' whole (frequent token) and split 'renormalizing' into pieces like 'ren ##orm ##al ##izing' (illustrative). The '##' marks continuation pieces, so only the first piece is a 'new word'.",
  regex: "Use anchored day-first groups: r'^(0?[1-9]|[12]\\d|3[01])[-.](0?[1-9]|1[0-2])[-.](\\d{4})$'. Groups 1–3 let you re-emit as DD/MM/YYYY. '2024-25-03' fails because the year slot requires exactly 4 digits and the month slot caps at 12.",
  stopwords: "No. Subword transformers rely on function words for negation and syntax, and the tokenizer must exactly match pretraining — removing stop words both deletes signal and breaks the interface. Remove them only for classic sparse models.",
  stemming: "Porter: 'run', 'stori', 'wa', 'gee'. WordNet with verb POS: 'run', 'stories' (unchanged — not a verb form), 'be', 'geese'. Surprises: rough outputs like 'stori'/'wa' aren't real words (rule-based chopping), and irregular forms survive only through the lexicon.",
  ngram: "Add-1 smoothing: P = (3+1)/(10+500) = 4/510 ≈ 0.0078. The denominator adds V (vocab size) to redistribute a little probability mass from seen events to unseen ones.",
  pos: "Ambiguous! 'flies' can be VERB ('time flies') or NOUN (the insects). A tagger outputs per-tag probabilities from context; most taggers choose VERB here — a classic case of why contextual disambiguation matters.",
  ner: "New(B-GPE) Delhi(I-GPE), hosts(O), the(O). 'AI Summit' would be B-/I-EVENT in schemas that model events (many models don't), and '2024' → B-DATE. Exact labels depend on the model's entity inventory.",
  parsing: "ROOT = 'jumps'. fox → nsubj(jumps); over → prep(jumps); dog → pobj(over); The → det(fox), quick → amod(fox); the → det(dog), lazy → amod(dog); '.' → punct(jumps).",
  syntax: "Most likely Sunil by recency, but 'He' could also be Ravi — deciding needs discourse preferences plus world knowledge (who smiles after being greeted?). This underdetermination is exactly why coreference resolution is hard.",
  tfidf: "tf = 3/30 = 0.1 and log₂(10) ≈ 3.32, so weight ≈ 0.33. sklearn's smoothed idf is ln((1+N)/(1+df)) + 1, which is always ≥ 1 > 0 — the +1 smoothing keeps weights positive.",
  embeddings: "A static embedding must average all contexts, so 'bank' becomes a mixture of river and finance. Contextual models (BERT) compute a fresh vector per occurrence, attending to the surrounding words, so the two senses stay separate.",
  classification: "Unigram BoW (usually after stop-word removal) drops 'No' — the model effectively reads 'great job' → positive. Fixes: keep negators and use bigrams ('not great'), use a lexicon with negation handling (VADER), or fine-tune a transformer.",
  "mt-summarization-qa": "ROUGE-1 recall — a copied headline maximizes reference unigram overlap. It misleads because ROUGE rewards content coverage, not comprehension or non-redundancy; pair it with human factuality checks.",
  "rnn-lstm": "At inference there is no gold previous token — the model conditions on its own (possibly wrong) output, so errors compound ('exposure bias'). Mitigations: beam search, scheduled sampling during training, or non-autoregressive decoding.",
  attention: "QKᵀ has shape (512 × 512) per head. Doubling T makes the attention matrix quadratically larger — 4× the compute — while embeddings and FFN layers stay linear in T.",
  "bert-gpt": "Fine-tune a BERT-family head (DistilBERT/RoBERTa): 300 labels are enough for a solid classifier and trains in minutes. GPT zero-shot is fine for prototyping, but prompt sensitivity and weaker calibration make it riskier for production.",
  evaluation: "F1 = 2·(0.9 × 0.3)/(0.9 + 0.3) = 0.54/1.2 = 0.45. High precision (rarely false-alarms) but low recall (misses 70% of positives) — dangerously conservative for screening-style tasks.",
  responsible: "Four risks with mitigations: PII in logs → redact before storing; confidential text exposure → access controls + retention windows; GDPR/consent gaps → data minimisation; misuse/bias → per-group evaluation and human review of low-confidence outputs.",
};

/* ------------------------------------------------------------------ */
/* Composers                                                           */
/* ------------------------------------------------------------------ */

const CLOSERS = [
  "Want the **Python code**, a **deeper explanation**, or a **practice question** on this? (The quick chips below send it in one click.)",
  "Say **“give me the code”**, **“explain more deeply”**, or **“ask me a practice question”** and I'll continue from here.",
  "You can also drag your course notes into the **Documents** panel and ask with 📎 — I'll quote the exact pages.",
];

function lessonBody(card: TopicCard, opts: { withCode: boolean; deep: boolean }): string {
  const L: string[] = [];
  L.push(`## ${card.title}`, "", card.definition, "");
  L.push(`**Intuition.** ${card.intuition}`, "");

  if (opts.deep) {
    L.push("### How it works, step by step", "");
    card.steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));
    L.push("");
  }
  L.push(`**Worked example.** ${card.example}`, "");

  if (opts.withCode && card.code) {
    L.push("### Python", "", `**Setup:** \`${card.code.install}\``, "", `${FENCE}python`, card.code.code, FENCE, "", `**Expected output** *(indicative, from a typical run — not executed here):*`, "", FENCE, card.code.output, FENCE, "", `${card.code.note}`, "");
  }

  if (opts.deep) {
    L.push("### Strengths & limitations", "");
    for (const p of card.pros) L.push(`- ✅ ${p}`);
    for (const c of card.cons) L.push(`- ⚠️ ${c}`);
    L.push("", "### Common mistakes", "");
    for (const m of card.mistakes) L.push(`- ${m}`);
    L.push("");
  } else if (card.mistakes.length > 0) {
    L.push(`**Watch out.** ${card.mistakes[0]}`, "");
  }

  const notes = opts.deep ? card.examNotes : card.examNotes.slice(0, 2);
  L.push("### Exam corner", "");
  for (const n of notes) L.push(`- 📌 ${n}`);
  L.push("", `**Practice.** ${card.practice} *(Reply **“show answer”** to walk through it.)*`, "", `---`, pick(CLOSERS));
  return L.join("\n");
}

function quickAnswer(card: TopicCard): string {
  return lessonBody(card, { withCode: false, deep: false });
}

function fullLesson(card: TopicCard): string {
  return lessonBody(card, { withCode: true, deep: true });
}

function simpleAnswer(card: TopicCard): string {
  const L: string[] = [];
  L.push(`## ${card.title} — the short version`, "");
  L.push(`**In one line:** ${card.short}.`, "");
  L.push(`**Think of it like this:** ${firstSentence(card.intuition)}`, "");
  L.push(`**Quick example:** ${firstSentence(card.example)}`, "");
  if (card.mistakes.length > 0) L.push(`**One thing to remember:** ${card.mistakes[0]}`, "");
  L.push(`---`, `Ready for the full lesson? Say **“explain ${/^(introduction|intro)/i.test(card.title) ? "NLP" : "this"} more deeply”**, or go level by level: **code** → **practice question** → **exam corner**.`);
  return L.join("\n");
}

function codeAnswer(card: TopicCard): string {
  if (!card.code) {
    const L: string[] = [];
    L.push(`## ${card.title} — no ready-made snippet for this one`, "");
    L.push(`I cover this topic conceptually rather than with a code recipe. Closest hands-on siblings with full Python: tokenization, stemming/lemmatization, regex, POS/NER, TF-IDF, embeddings, sentiment classification, attention, and evaluation metrics.`, "");
    L.push(`**Core idea anyway:** ${card.definition}`, "", `---`, pick(CLOSERS));
    return L.join("\n");
  }
  const L: string[] = [];
  L.push(`## ${card.title} — Python`, "");
  L.push(`**Setup:** \`${card.code.install}\``, "");
  L.push(`${FENCE}python`, card.code.code, FENCE, "");
  L.push(`**Expected output** *(indicative, from a typical run):*`, "", FENCE, card.code.output, FENCE, "");
  L.push(`${card.code.note}`, "");
  // Two most exam-relevant steps as "reading guide"
  L.push("### How to read it", "");
  L.push(`1. ${card.steps[0]}`);
  if (card.steps[2]) L.push(`2. ${card.steps[2]}`);
  L.push("");
  L.push(`**Common mistake:** ${card.mistakes[0]}`, "");
  L.push(`---`, `Say **“explain this more deeply”** for the theory, or **“ask me a practice question”** to check yourself.`);
  return L.join("\n");
}

function exampleAnswer(card: TopicCard): string {
  const L: string[] = [];
  L.push(`**Here's a worked example for ${card.title.toLowerCase()}:**`, "", card.example, "");
  if (card.code) {
    L.push(`If you want to *run* something similar, say **“show me the Python code”** — I have a runnable snippet for this topic.`, "");
  }
  L.push(`**Related watch-out:** ${card.cons[0] ?? card.useWhen}`, "", `---`, pick(CLOSERS));
  return L.join("\n");
}

function practiceAnswer(card: TopicCard): string {
  const L: string[] = [];
  L.push(`### 🎯 Practice question — ${card.title}`, "");
  L.push(`**Question:** ${card.practice}`, "");
  L.push(`Take a minute and reason it out first.`, "");
  L.push(`When you're ready, reply **“show answer”** and I'll walk you through the reasoning.`, "");
  return L.join("\n");
}

function revealAnswer(card: TopicCard | null): string {
  if (!card) {
    return "There's no practice question in play yet — ask me **“ask me a practice question”** on any topic and I'll set one up (then you can ask for the answer).";
  }
  const solution = PRACTICE_SOLUTIONS[card.id];
  const L: string[] = [];
  L.push(`### Answer walkthrough — ${card.title}`, "");
  L.push(`**The question was:** ${card.practice}`, "");
  L.push(`**Working through it:** ${solution ?? "I don't have a stored worked solution for this one — attempt it, then compare your reasoning with the exam tips below and the code in the lesson."}`, "");
  if (!solution) {
    L.push("", "**Exam tips for this topic:**");
    for (const n of card.examNotes) L.push(`- 📌 ${n}`);
  }
  L.push("", `Want another one? Say **“ask me a practice question”** again, or switch topics any time.`);
  return L.join("\n");
}

function examAnswer(cards: TopicCard[]): string {
  const L: string[] = [];
  L.push(`## 📝 Exam prep${cards.length > 1 ? ` — ${cards.length} topics` : ``}`, "");
  for (const card of cards.slice(0, 3)) {
    L.push(`### ${card.title}`, "");
    L.push(`*${card.short}.*`, "");
    for (const n of card.examNotes) L.push(`- 📌 ${n}`);
    L.push("");
  }
  if (cards.length > 1) {
    L.push(`These are the three most exam-relevant built-in highlights. Say **“exam notes on X”** — X can be tokenization, TF-IDF, embeddings, NER, attention, BERT/GPT, evaluation metrics… — for a focused sheet.`, "");
  }
  L.push(`**How to use these:** rewrite each bullet from memory, then check against your course notes (upload them in **Documents** and I'll verify against YOUR syllabus wording — your notes always take priority).`, "");
  L.push(`---`, pick(CLOSERS));
  return L.join("\n");
}

/** General sheet when the user asks for exam prep without naming a topic. */
function generalExamAnswer(): string {
  const popular = ["attention", "evaluation", "bert-gpt"]
    .map((id) => CARD_BY_ID.get(id))
    .filter((c): c is TopicCard => Boolean(c));
  return examAnswer(popular);
}

function compareFromTable(t: CompareTable): string {
  const parts = t.title.split(/\s+vs\s+/);
  const titleRow =
    parts.length === 2 ? `| Aspect | ${parts[0]} | ${parts[1]} |` : `| Aspect | ${t.title} |`;
  const columnCount = parts.length === 2 ? 3 : 2;
  const sepRow = columnCount === 3 ? "|---|---|---|" : "|---|---|";
  const L: string[] = [];
  L.push(`## ⚖️ ${t.title}`, "", t.intro, "", titleRow, sepRow);
  for (const [aspect, a, b] of t.rows) L.push(`| ${aspect} | ${a} | ${b} |`);
  L.push("", `**Rule of thumb.** ${t.rule}`, "", `---`, `Want a full lesson on one side? Ask “explain ${parts[0]?.toLowerCase() ?? "the first one"} step by step”.`);
  return L.join("\n");
}

function genericCompare(a: TopicCard, b: TopicCard): string {
  const L: string[] = [];
  L.push(`## ⚖️ ${a.title} vs ${b.title}`, "");
  L.push(`These solve related-but-different problems, so the “right” choice depends on your task:`, "");
  L.push(`| Aspect | ${a.title} | ${b.title} |`, "|---|---|---|");
  L.push(`| One-liner | ${a.short} | ${b.short} |`);
  L.push(`| Use it when | ${a.useWhen} | ${b.useWhen} |`);
  L.push(`| Watch out | ${a.cons[0] ?? a.mistakes[0] ?? "—"} | ${b.cons[0] ?? b.mistakes[0] ?? "—"} |`);
  L.push("", `If your exam gives one sentence each, lead with the one-liners above, then name one concrete example (${a.example.split(/[.;]/)[0]}\u2026).`, "", `---`, pick(CLOSERS));
  return L.join("\n");
}

/* ------------------------------------------------------------------ */
/* Conversational answers                                              */
/* ------------------------------------------------------------------ */

const TOPIC_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: "Start here", ids: ["intro"] },
  { label: "Text basics", ids: ["preprocessing", "tokenization", "regex", "stopwords", "stemming"] },
  { label: "Representations", ids: ["ngram", "tfidf", "embeddings"] },
  { label: "Linguistics", ids: ["pos", "ner", "parsing", "syntax"] },
  { label: "Classic tasks", ids: ["classification", "mt-summarization-qa", "evaluation"] },
  { label: "Deep learning & LLMs", ids: ["rnn-lstm", "attention", "bert-gpt", "llm-rag"] },
  { label: "Responsible AI", ids: ["responsible"] },
];

function topicsAnswer(): string {
  const L: string[] = [];
  L.push(`## What I can teach you`, "");
  for (const g of TOPIC_GROUPS) {
    L.push(`**${g.label}**`);
    for (const id of g.ids) {
      const card = CARD_BY_ID.get(id);
      if (card) L.push(`- **${card.title.replace(/\s*\(.*\)$/, "")}** — ${card.short.toLowerCase()}`);
    }
    L.push("");
  }
  L.push(`Try one of these:`, "");
  L.push(`- “Explain **TF-IDF** step by step”`, `- “Show me **Python code** for tokenization”`, `- “**Stemming vs lemmatization**”`, `- “Quiz me on **attention**”`, "", `You can also ask me anything about **your uploaded notes** (📎 in the composer) — I quote real page numbers from them.`);
  return L.join("\n");
}

function capabilitiesAnswer(): string {
  const L: string[] = [];
  L.push(`I'm your NLP study tutor — here's the honest scope of what I do:`, "");
  L.push(`- 📚 **Full lessons** — 20 core NLP topics with intuition, steps, examples and exam notes;`, `- ⚖️ **Comparisons** — “TF-IDF vs embeddings”, “BERT vs GPT”, tables with rule-of-thumb advice;`, `- 🐍 **Python code** — runnable snippets for tokenization, stemming, NER, sentiment, attention, metrics and more;`, `- 🎯 **Practice questions** — ask me to “test me” on any topic, then “show answer” for the walkthrough;`, `- 📝 **Exam prep** — “exam notes on attention” gathers the key facts per topic;`, `- 📎 **Your notes** — upload PDFs/text in **Documents** and ask with 📎; I quote the exact pages the answer comes from;`, `- 🧪 Plus the **Quiz**, **Glossary**, **Code examples** and **Roadmap** tabs up top.`, "");
  L.push(`I run **fully offline** on your machine — no API key needed. (If your admin adds \`AI_API_KEY\` to \`server/.env\`, I'll hand over to a live LLM for anything beyond my built-in topics.)`, "");
  L.push(`What shall we study first?`);
  return L.join("\n");
}

function identityAnswer(): string {
  return `Good question — being precise here: I'm the **built-in offline tutor engine** of NLP Tutor AI. Not ChatGPT, not a hidden cloud model: I'm a rule-based knowledge base + answer composer that runs entirely on your machine, so I work with **no API key and no internet**. I'm transparent about this — I know NLP deeply, but I don't have web access and I won't invent APIs or results. If someone configures a provider in \`server/.env\` (\`AI_API_KEY\` / \`AI_BASE_URL\` / \`AI_MODEL\`), replies switch to that live model instead — this app tells you which mode is active in the header.`;
}

function greetingAnswer(): string {
  return pick([
    `Hey! 👋 I'm your NLP study tutor — I explain topics with intuition and examples, write runnable Python, compare methods, drill you with practice questions, and ground answers in your uploaded notes. All offline, no API key needed.\n\nWhat are we studying today? Try **“explain attention step by step”** or **“stemming vs lemmatization”**.`,
    `Hello! 👋 Ready for some NLP? I can teach tokenization, TF-IDF, transformers and 17 more topics, with code and exam prep. Try **“quiz me on embeddings”** or paste a question — or ask **“what topics do you cover?”**`,
    `Hi there! 👋 Your NLP tutor here — offline and ready. Deep lessons, Python snippets, comparison tables, practice questions. What's on your plate: theory, code, or exam prep?`,
  ]);
}

function thanksAnswer(): string {
  return pick([
    `You're welcome! 🎓 Anything else — code, depth, practice, or shall we move to the next topic?`,
    `Happy to help! Say **“ask me a practice question”** when you want to check yourself, or just throw the next topic at me.`,
    `Anytime! 💪 Next up whenever you are.`,
  ]);
}

function yesAnswer(card: TopicCard | null): string {
  if (!card) return `Great! What shall we start with? Ask for a **topic lesson**, **code**, a **comparison**, or a **practice question** — e.g. “explain TF-IDF step by step”.`;
  return `Nice — continuing with **${card.title}**. You can say: **“explain it more deeply”** (full lesson), **“show me the Python code”**, **“ask me a practice question”**, or **“simplify it”**.`;
}

function noAnswer(): string {
  return `No problem! 👋 I'll be here whenever you want to continue — just ask, or pick up from the **Roadmap** tab to plan your next step.`;
}

function smalltalkAnswer(): string {
  return pick([
    `Doing great, thanks for asking — I never run out of energy for NLP 😄 How's your prep going? Want a quick practice question to warm up?`,
    `Why did the tokenizer break up with the regex? Too many unresolved issues… 💔\n\nBack to business: tokenization, TF-IDF, attention — pick your poison.`,
  ]);
}

function offTopicAnswer(): string {
  return `That one's outside my lane 😅 — I'm a focused NLP study tutor (built-in knowledge base, no internet), so I'd rather be straight with you than confidently make something up.\n\nWhat I *can* do right now:\n- Teach any of my **20 NLP topics** with intuition, steps and exam notes\n- Write **Python** for tokenization, stemming, NER, sentiment, attention, metrics…\n- Contrast methods like **BERT vs GPT** or **stemming vs lemmatization**\n- Answer questions **from your uploaded notes** (📎)\n\nWant one of those?`;
}

function quizPointerAnswer(card: TopicCard | null): string {
  const topic = card ? ` on **${card.title}**` : "";
  return `For a full multiple-choice quiz${topic}, open the **Quiz** tab (beaker icon in the top bar) and hit *Generate* — it builds a fresh MCQ set and scores you with per-question explanations.\n\nPrefer staying here in chat? I can drill you verbally instead: say **“ask me a practice question”${card ? "" : " on any topic"}** and I'll pose one, then **“show answer”** to walk through it.`;
}

function needTopicAnswer(kind: "code" | "practice" | "detail" | "example" | "exam" | "simple"): string {
  const ask: Record<string, string> = {
    code: "write Python for",
    practice: "quiz you on",
    detail: "explain in depth",
    example: "give examples for",
    exam: "prepare exam notes for",
    simple: "simplify",
  };
  const sample = pick(["tokenization", "TF-IDF", "attention", "embeddings", "evaluation metrics"]);
  const example =
    kind === "code"
      ? `Python code for ${sample}`
      : kind === "practice"
        ? `test me on ${sample}`
        : kind === "simple"
          ? `simplify ${sample}`
          : kind === "exam"
            ? `exam notes on ${sample}`
            : `explain ${sample}`;
  return `Happy to ${ask[kind]} — just tell me **which topic**. For example: “${example}”.\n\n(Tip: this works because I'm a built-in knowledge base — ask **what topics do you cover?** to see the full list.)`;
}

function unknownAnswer(ranked: Array<{ card: TopicCard; score: number }>, message: string): string {
  const close = ranked.filter((r) => r.score > 0).slice(0, 3);
  const asked = message.trim().replace(/\s+/g, " ").slice(0, 90);
  const L: string[] = [];
  L.push(`Honest answer: **I don't have a built-in lesson for “${asked}”** — I'm an offline knowledge base, not a live model, and I'd rather admit that than invent something.`, "");
  if (close.length > 0) {
    L.push(`Closest things I *do* cover well:`);
    for (const c of close) L.push(`- **${c.card.title}** — ${c.card.short.toLowerCase()}`);
    L.push(`- …ask for any of these and I'll go deep (theory, Python, exam prep).`);
  } else {
    L.push(`Here's the map of what I cover:`);
    for (const g of TOPIC_GROUPS.slice(0, 6)) {
      L.push(`- **${g.label}:** ${g.ids.map((id) => CARD_BY_ID.get(id)?.title.replace(/\s*\(.*\)$/, "").split(/[:,]/)[0]).filter(Boolean).join(", ")}`);
    }
  }
  L.push("", `Two ways to go further: ask me about one of those topics, or **upload your course notes** in Documents and ask again with 📎 — if your notes cover it, I'll quote the relevant pages directly.`);
  return L.join("\n");
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

export interface OfflineContext {
  chatId?: string;
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export function composeOfflineAnswer(ctx: OfflineContext): string {
  const message = ctx.message.trim();

  /* ---------- 0) quick conversational lanes that outrank topics ------ */
  // (greetings/thanks are only checked AFTER topic matching fails, except
  // pure-greeting which must win even if message contains stray words.)
  if (RE.greeting.test(message) && message.length <= 30) return greetingAnswer();
  if (RE.yes.test(message)) return yesAnswer(resolveLastTopic(ctx.chatId, ctx.history ?? []));
  if (RE.no.test(message)) return noAnswer();

  /* ---------- 1) topical matching ------------------------------------ */
  const ranked = scoreAll(message);
  const matches = ranked.filter((r) => r.score >= MATCH_THRESHOLD);
  const followupKind: "code" | "practice" | "detail" | "example" | "exam" | "simple" | null = (() => {
    if (RE.reveal.test(message)) return null; // reveal handled via lastTopic below
    if (RE.code.test(message)) return "code";
    if (RE.practice.test(message)) return "practice";
    if (RE.exam.test(message)) return "exam";
    if (RE.simple.test(message)) return "simple";
    if (RE.example.test(message)) return "example";
    if (RE.detail.test(message)) return "detail";
    return null;
  })();

  if (matches.length > 0) {
    const best = matches[0];

    /* comparison requests */
    if (RE.compare.test(message)) {
      const curated = COMPARE_TABLES.find((t) => {
        try {
          return new RegExp(t.keywords, "i").test(message);
        } catch {
          return false;
        }
      });
      if (curated) {
        rememberTopic(ctx.chatId, CARD_BY_ID.get(best.card.id) ?? best.card);
        return compareFromTable(curated);
      }
      const second = matches.find((m) => m.card.id !== best.card.id);
      if (second) {
        rememberTopic(ctx.chatId, best.card);
        return genericCompare(best.card, second.card);
      }
      // fall through to normal topic treatment if only one card matched
    }

    rememberTopic(ctx.chatId, best.card);

    /* quiz page pointer */
    if (RE.quizPage.test(message) && !RE.practice.test(message)) return quizPointerAnswer(best.card);

    /* topical answers with modifiers */
    if (followupKind === "code") return codeAnswer(best.card);
    if (followupKind === "practice") return practiceAnswer(best.card);
    if (followupKind === "exam") return examAnswer([best.card]);
    if (followupKind === "simple") return simpleAnswer(best.card);
    if (followupKind === "example") return exampleAnswer(best.card);
    if (followupKind === "detail" || RE.deepish.test(message)) return fullLesson(best.card);
    return quickAnswer(best.card);
  }

  /* ---------- 2) follow-ups riding on the last topic ------------------ */
  if (RE.reveal.test(message)) {
    const last = resolveLastTopic(ctx.chatId, ctx.history ?? []);
    return revealAnswer(last);
  }
  if (RE.quizPage.test(message)) return quizPointerAnswer(null);
  if (followupKind) {
    const last = resolveLastTopic(ctx.chatId, ctx.history ?? []);
    if (followupKind === "exam" && !last) return generalExamAnswer();
    if (last) {
      rememberTopic(ctx.chatId, last);
      switch (followupKind) {
        case "code":
          return codeAnswer(last);
        case "practice":
          return practiceAnswer(last);
        case "exam":
          return examAnswer([last]);
        case "simple":
          return simpleAnswer(last);
        case "example":
          return exampleAnswer(last);
        case "detail":
          return fullLesson(last);
      }
    }
    return needTopicAnswer(followupKind);
  }

  /* ---------- 3) pure conversation ----------------------------------- */
  if (RE.capabilities.test(message)) return capabilitiesAnswer();
  if (RE.identity.test(message)) return identityAnswer();
  if (RE.topicsList.test(message)) return topicsAnswer();
  if (RE.thanks.test(message)) return thanksAnswer();
  if (RE.smalltalk.test(message)) return smalltalkAnswer();
  if (RE.offTopic.test(message)) return offTopicAnswer();

  /* ---------- 4) unknown --------------------------------------------- */
  return unknownAnswer(ranked, message);
}

/* ------------------------------------------------------------------ */
/* Offline banner (shown once per chat, plus on grounded doc answers)  */
/* ------------------------------------------------------------------ */

export const OFFLINE_BANNER =
  "> 🧠 **Offline tutor** — no AI provider is configured, so replies come from the built-in NLP knowledge base running on your machine (no external API). Add `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` to `server/.env` and restart to switch to a live model.\n\n";

const bannerShownFor = new Set<string>();

/** True only for the first offline message of a chat (or when no chatId). */
export function shouldShowOfflineBanner(chatId: string | undefined): boolean {
  if (!chatId) return true;
  if (bannerShownFor.has(chatId)) return false;
  bannerShownFor.add(chatId);
  if (bannerShownFor.size > MAX_TRACKED_CHATS) {
    const oldest = bannerShownFor.values().next().value;
    if (oldest !== undefined) bannerShownFor.delete(oldest);
  }
  return true;
}

/** For tests / observability. */
export const offlineTutorStats = {
  topics: TOPIC_CARDS.length,
  comparisons: COMPARE_TABLES.length,
  practiceSolutions: Object.keys(PRACTICE_SOLUTIONS).length,
};
