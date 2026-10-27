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

/* ------------------------------------------------------------------ */
/* Catching layer: normalize + paraphrase fragments + fuzzy matching.  */
/* Lets the engine "catch" human-style questions: typos ("toknization"),
 * spaced/dashed terms ("tf idf", "bag of words"), reworded phrasings.  */
/* ------------------------------------------------------------------ */

function normalizeMessage(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, " ") // dashes → spaces
    .replace(/[^a-z0-9\s]/g, " ") // punctuation → spaces
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** Per-topic regex fragments applied to the NORMALIZED message. */
const CATCH_FRAGMENTS: Record<string, string[]> = {
  intro: ["\\bn ?l ?p\\b|natural language processing|nlp applications"],
  preprocessing: ["normali[sz]|\\bclean\\b|unicode|lowercas|preprocess"],
  tokenization: ["token[isz]|subword|word ?piece|sentence ?piece|\\bbpe\\b"],
  regex: ["regex|regular expression"],
  stopwords: ["stop ?words?|stopword"],
  stemming: ["stemm|lemmati|lemma|porter|snowball"],
  ngram: ["n ?gram|bigram|trigram|language model|smooth|laplace|kneser|perplex"],
  pos: ["\\bpos\\b|part of speech|viterbi|tagg"],
  ner: ["\\bner\\b|named entit|entity recognition"],
  parsing: ["\\bpars(e|er|ing)\\b|constituen|dependenc"],
  syntax: ["anaphor|coref|discourse|word sense|ambiguit|pragmat"],
  tfidf: ["tf ?idf|bag ?of ?words|\\bbow\\b|one ?hot|term frequency|inverse document freq"],
  embeddings: ["embedding|word2vec|skip ?gram|\\bcbow\\b|glove|fasttext"],
  classification: ["sentiment|spam|classif|vader"],
  "mt-summarization-qa": ["translat|summar|question answer|\\bqa\\b|abstractive|extractive"],
  "rnn-lstm": ["\\brnn\\b|\\blstm\\b|\\bgru\\b|seq ?2 ?seq|recurrent"],
  attention: ["transformer|attention|self ?attention|positional en|multi ?head"],
  "bert-gpt": ["\\bbert\\b|\\bgpt\\b|masked language model|transfer learning|fine ?tun|pretrain"],
  "llm-rag": ["\\bllm\\b|\\brag\\b|prompt|hallucinat|retrieval aug|in ?context|few ?shot|zero ?shot"],
  evaluation: ["evaluat|\\bf ?1\\b|precision|recall|\\bbleu\\b|\\brouge\\b|perplex|accuracy|confusion matrix|metric"],
  responsible: ["\\bbias\\b|fairness|privacy|gdpr|toxicity|prompt injection|drift|deployment|ethic"],
};

/** Per-topic terms tolerated with small spelling errors (len ≥ 4 only). */
const FUZZY_TERMS: Record<string, string[]> = {
  preprocessing: ["normalization", "normalisation", "lowercase", "cleaning"],
  tokenization: ["tokenization", "tokenisation", "tokenizer"],
  regex: ["regex"],
  stopwords: ["stopwords", "stopword"],
  stemming: ["stemming", "lemmatization", "lematisation"],
  ngram: ["bigram", "trigram", "laplace", "perplexity"],
  pos: ["tagging", "tagger", "viterbi"],
  parsing: ["dependency", "constituency", "parser"],
  syntax: ["anaphora", "coreference", "discourse", "ambiguity", "semantics"],
  tfidf: ["tfidf"],
  embeddings: ["word2vec", "glove", "fasttext"],
  classification: ["sentiment", "classification", "spam"],
  "mt-summarization-qa": ["summarization", "summarisation", "translation", "abstractive"],
  "rnn-lstm": ["recurrent", "seq2seq"],
  attention: ["attention", "transformer", "positional"],
  "llm-rag": ["prompt", "hallucination", "retrieval"],
  evaluation: ["perplexity", "precision", "recall", "confusion"],
  responsible: ["bias", "fairness", "privacy"],
};

function catchBonus(
  cardId: string,
  normalized: string,
  tokens: string[],
): number {
  let score = 0;
  // 1) normalized-paraphrase fragments (spacing/hyphen/rewording variants)
  let fragmentHits = 0;
  for (const frag of CATCH_FRAGMENTS[cardId] ?? []) {
    try {
      if (new RegExp(frag, "i").test(normalized)) fragmentHits += 1;
    } catch {
      /* a bad fragment must never crash the engine */
    }
  }
  if (fragmentHits > 0) score += 3; // one clean fragment ≈ one keyword hit
  // 2) fuzzy (typo-tolerant) matching against curated topic terms
  let fuzzyHits = 0;
  for (const term of FUZZY_TERMS[cardId] ?? []) {
    if (term.length < 4) continue;
    for (const tok of tokens) {
      if (tok.length < 4) continue;
      const d = levenshtein(term, tok);
      // distance 1 always counts; distance 2 only for long words that share
      // a 3-letter prefix ("tokanisation"≈"tokenization" ✅, but "learning"
      // must NOT hit "cleaning" — different prefixes, so no match).
      const doubledOk =
        d === 2 && term.length >= 8 && tok.length >= 8 && term.slice(0, 3) === tok.slice(0, 3);
      if (d === 1 || doubledOk) {
        fuzzyHits += 1;
        break;
      }
    }
  }
  return score + Math.min(fuzzyHits, 2) * 3;
}

function scoreAll(text: string): Array<{ card: TopicCard; score: number }> {
  const normalized = normalizeMessage(text);
  const tokens = Array.from(new Set(normalized.split(" ")));
  return TOPIC_CARDS.map((card) => ({
    card,
    score: scoreCard(card, text) + catchBonus(card.id, normalized, tokens),
  })).sort((a, b) => b.score - a.score);
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

/* Per-chat first names ("my name is Rahul") for personal greetings. */
const nameByChat = new Map<string, string>();

function tidyName(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z' -]/g, "").replace(/\s+/g, " ").slice(0, 20);
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : "";
}

function rememberName(chatId: string | undefined, name: string): void {
  if (!chatId) return;
  nameByChat.delete(chatId); // refresh recency
  nameByChat.set(chatId, name);
  if (nameByChat.size > MAX_TRACKED_CHATS) {
    const oldest = nameByChat.keys().next().value;
    if (oldest !== undefined) nameByChat.delete(oldest);
  }
}

function resolveName(chatId: string | undefined): string | null {
  if (chatId && nameByChat.has(chatId)) return nameByChat.get(chatId) ?? null;
  return null;
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
    /\bwhat can (you|u) (do|help)|how (can|do) (you|u) help|who (are|r) (you|u)|what are you|your (features|capabilit)|^\s*help\s*[?!.]*$/i,
  identity: /\b(are you (chatgpt|gpt|openai|an? ai|a bot|a real|human)|your name|what model|which model|made you|created you)\b/i,
  topicsList:
    /\b(what|which) topics|topics? (can|do) you (teach|cover|know)|list (of )?topics|topic list|what should i (study|learn|revise)|syllabus coverage|what do you know\b|what (can|do) you teach|^\s*(topics|topic list|menu)\s*[?!.]*$/i,
  compare: /\b(vs\.?|versus|differences? between|difference of|diff(er)? between|comparison between|compare(d)? (to|with|them)?|contrast|dif\S*\s+between)\b/i,

  reveal: /\b(reveal|shows?|gives?|tells?)\s+(me\s+)?(the\s+)?answer\b|^(answer|solution)\b|\b(what'?s|whats) the answer\b/i,
  practice:
    /\b(ask me|test me|quiz me|practice (question|questions|problem|problems)|give me (a )?(practice )?question|another question|one more question|next (question|one|round)|go again|a question on)\b/i,
  code: /\b(code|snippet|program|implement|write.*python|python (code|script|example)|code for)\b/i,
  exam: /\b(exam|exams|viva|midsem|semester|marks|important (points|questions|topics)|revision|revise|last minute|crash course)\b/i,
  simple:
    /\b(simplify|simpler|simple(r)? explanation|short(er)?|in brief|brief|tldr|eli5|like i'?m (5|new)|beginner version|summar(y|ize|ise)|quick version)\b/i,
  detail:
    /\b(more deeply|deeper|explain (it |this |that )?(more|further|again)|more detail|elaborat|expand|continue|go on|walk me through|in (more )?depth)\b/i,
  example: /\b(another example|more examples?|real.?world example|one example|use case|where (is|would) (it|this) (used|useful))\b/i,
  quizPage: /\b(generate|create|make|give me).{0,20}\b(quiz|mcqs?)\b|\bmcqs?\b/i,
  glossary: /\b(glossary|terminolog(y|ies))\b|definition of|meaning of\b|\bdefine [a-z]/i,
  roadmap:
    /\b(roadmap|study plan|learning path|syllabus plan)\b|\bhow (do|should) i (start|begin|study|learn)\b/i,

  deepish: /\b(explain|teach me|step by step|in depth|in detail|detail(ed)?|deep dive|thorough|from scratch|full lesson|everything about)\b/i,

  yes: /^(yes|yeah|yep|yus|ok(ay)?|sure|fine|go( ahead)?|please( do)?|continue|do it)[\s!.]*$/i,
  no: /^(no(p|pe)?|nah|not now|maybe later|nothing|bye|goodbye|see (ya|you)|thats all|that'?s all)[\s!,.]*$/i,

  smalltalk: /\b(how are you|hows it going|what'?s up|tell (me )?a joke|make me laugh|good (bot|job)|well done)\b/i,
  offTopic:
    /\b(write (me )?a (poem|story|essay|song)|sing|weather|recipe|cook|stock (price|market)|movie|netflix|song|cricket|football match|who will win|president of|prime minister|solve my (math|physics) homework|do my (assignment|homework))\b/i,

  /* behavioural conversation (greetings, moods, farewells, names) */
  bye: /\b(bye|goodbye|good\s?night|see (ya|u|you)( later)?|catch (you|u) later|gtg|g2g|tata|alvida|cya later)\b/i,
  howAreYou: /\bhow are you\b|\bhow'?s it going\b|\bhow do you do\b|\bhow have you been\b|\bkaise ho\b/i,
  aboutYou: /\b(what|how) about you\b|\band you\b\s*\?*$|\byour day\b/i,
  moodGood:
    /\b(i'?m|im|i am|feeling|doing|am)\s+(fine|good|great|okay|ok\b|nice|awesome|amazing|excited|hyped|ready|well)\b|^all good\b|^pretty good\b|^ready[\s!.]*$|^great[\s!.]*$|^good[\s!.]*$|^awesome[\s!.]*$|^nice[\s!.]*$/i,
  moodBad:
    /\b(i'?m|im|i am|feeling)\s+(not\s+(good|great|fine)|bad|low|sad|tired|stress(ed|ful)?|exhausted|weak|dull|demotivated|blank|lost)|^(bad|tired|stressed|sad|not good|not great|not fine)\b|\bbad day\b|\bhard day\b/i,
  nameAsk: /\b(?:my name is|call me|i am called|you can call me)\s+([a-z][a-z' -]{1,19})\b/i,
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

function greetingAnswer(
  chatId: string | undefined,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  raw: string,
): string {
  const name = resolveName(chatId);
  const last = resolveLastTopic(chatId, history);
  const returning = Boolean(last) || history.some((h) => h.role === "user" && h.content.trim());
  const time = /\bmorning\b/i.test(raw)
    ? "Good morning"
    : /\bafternoon\b/i.test(raw)
      ? "Good afternoon"
      : /\b(evening|night)\b/i.test(raw)
        ? "Good evening"
        : null;
  const greet = time
    ? `${time}${name ? `, ${name}` : ""}! 👋`
    : name && returning
      ? `Welcome back, ${name}! 👋`
      : name
        ? `Hey ${name}! 👋`
        : returning
          ? `Welcome back! 👋`
          : pick([`Hey! 👋`, `Hello${time ? "" : " there"}! 👋`, `Hi! 👋`]);

  if (returning && last) {
    return `${greet} I'm your NLP study tutor — still fully offline, still ready.\n\nLast time we were looking at **${last.title.replace(/\s*\(.*\)$/, "")}**. Pick up where we left off (**"explain it more deeply"** or **"ask me a practice question"**), or start something new — what would you like?`;
  }
  if (returning) {
    return `${greet} I'm your NLP study tutor. We've chatted before but I don't have a topic on record (memory resets with every server restart — honest limitation).\n\nWhat's on today's plan: a new topic, Python code, practice questions, or exam prep?`;
  }
  const ask = pick([
    `What are we studying today — theory, Python, or exam prep?`,
    `How's the syllabus treating you — anything particular giving trouble?`,
    `Ready to dive in, or shall I suggest a topic first?`,
  ]);
  return `${greet} I'm your NLP study tutor — 20 topics explained with intuition, runnable Python code, comparison tables and practice drills. All offline, no API key needed.\n\n${ask} Try **"explain attention step by step"**, or ask **"what topics do you cover?"**`;
}

function goodbyeAnswer(chatId: string | undefined): string {
  const name = resolveName(chatId);
  const you = name ? `, ${name}` : "";
  return pick([
    `See you${you}! 👋 Your roadmap and quiz progress are saved in the browser — drop by anytime. Good luck with the studies!`,
    `Bye${you}! 🙌 Remember: the night before an exam, my **"exam notes on …"** summaries are at your service. Take care!`,
    `Goodbye${you}! I'll remember ${name ? "your name" : "the topics we covered"} next time we chat (as long as the server isn't restarted). Happy studying! 📚`,
  ]);
}

function howAreYouAnswer(): string {
  return pick([
    `Doing great, thanks for asking! 😄 I never run out of energy for NLP — this is basically my favourite subject.\n\nMore importantly — how is YOUR preparation going? Give me one word and I'll shape today's plan around it.`,
    `All systems running smoothly — no API calls, no downtime, endless patience ☕\n\nHow about you: fresh and focused, or running on fumes? That decides whether we do a deep lesson or a quick revision round.`,
  ]);
}

function aboutYouAnswer(): string {
  return `Me? I'm the resident text nerd 🤓 — my entire world is made of tokens, embeddings and exam notes. I never get bored and never sleep.\n\nBut this session is about YOU: which topic shall we take — or tell me how your prep is going and I'll pick for you?`;
}

function moodGoodAnswer(): string {
  return pick([
    `Love that energy! 🙌 Let's spend it well:\n- Say **"explain <topic> step by step"** for a deep dive,\n- **"ask me a practice question"** to check sharpness,\n- or **"exam notes on <topic>"** to bank some revision. What'll it be?`,
    `Great to hear! 😄 While the streak is hot, want to try something slightly outside the comfort zone — embeddings? attention? BERT vs GPT? Just name the topic.`,
  ]);
}

function moodBadAnswer(): string {
  return pick([
    `That's okay — rough days happen, and they don't erase what you know 💙\n\nLet's go gentle: I can give you a **short, simple version** of any topic (say **"simplify tokenization"**), do a **5-minute practice question**, or just map out a realistic plan from the **Roadmap** tab. What feels doable right now?`,
    `Sorry to hear that 😔 No pressure here. Want an encouraging half-triumph? Pick the topic that's annoying you and say **"explain it simply"** — I'll make it bite-sized. (Or take a break; the **Roadmap** will still be here tomorrow.)`,
  ]);
}

function nameAnswer(name: string): string {
  return `Nice to meet you, **${name}**! 🤝 I'll remember that name for this session.\n\nSo ${name}, what brings you here today — a topic lesson, Python code, practice questions, or exam prep? (Say **"topics"** if you want the full menu.)`;
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

function glossaryPointerAnswer(): string {
  return `Quick definitions live in the **Glossary** tab (book icon in the top bar) — 45+ NLP terms with examples, and each entry has an “Ask tutor” jump that starts a full chat explanation.\n\nIf you want a proper lesson instead (intuition → steps → example → exam notes), just ask about the topic directly, e.g. **“explain perplexity”** or **“explain attention”**.`;
}

function roadmapPointerAnswer(): string {
  const L: string[] = [];
  L.push(`For the big picture, open the **Roadmap** tab (map icon in the top bar) — it lays the whole subject out in **8 stages** (text basics → classical ML → deep learning → deployment), each with prerequisites and checkboxes, and your ticked progress saves in your browser.`);
  L.push("", `A good loop between me and the roadmap:`);
  L.push(`1. Tick what you've already covered in the Roadmap tab;`);
  L.push(`2. Ask me here for any stage's topic, e.g. **“explain tokenization step by step”**;`);
  L.push(`3. Say **“ask me a practice question”** to lock it in, and **“exam notes on X”** the night before.`);
  L.push("", `Or skip planning and dive straight into a topic — say **“topics”** for the full list.`);
  return L.join("\n");
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

/* Reply shape: composed text + a coarse intent tag (used by the client to
   pick sensible follow-up chips, e.g. explorer chips under a greeting). */
export type OfflineIntent =
  | "greeting"
  | "bye"
  | "mood"
  | "name"
  | "confirmation"
  | "decline"
  | "conversation"
  | "capabilities"
  | "identity"
  | "topics"
  | "glossary-point"
  | "roadmap-point"
  | "quiz-point"
  | "notes-point"
  | "need-topic"
  | "lesson"
  | "compare"
  | "code"
  | "practice"
  | "reveal"
  | "exam"
  | "simple"
  | "example"
  | "detail"
  | "off-topic"
  | "unknown";

const BAD_NAME_CAPTURE = /^(later|tomorrow|today|back|again|now|soon|anytime|ok|okay)$/i;

export interface ComposedReply {
  text: string;
  intent: OfflineIntent;
}

export function composeOffline(ctx: OfflineContext): ComposedReply {
  const message = ctx.message.trim();

  /* ---------- 0) quick conversational lanes that outrank topics ------ */
  // (greetings/thanks are only checked AFTER topic matching fails, except
  // pure-greeting which must win even if message contains stray words.)
  if (RE.greeting.test(message) && message.length <= 30) {
    return { text: greetingAnswer(ctx.chatId, ctx.history ?? [], message), intent: "greeting" };
  }
  if (RE.bye.test(message)) {
    return { text: goodbyeAnswer(ctx.chatId), intent: "bye" };
  }
  const nameMatch = message.match(RE.nameAsk);
  const capturedName = nameMatch?.[1] ? tidyName(nameMatch[1]) : "";
  if (capturedName && !BAD_NAME_CAPTURE.test(capturedName)) {
    rememberName(ctx.chatId, capturedName);
    return { text: nameAnswer(capturedName), intent: "name" };
  }
  if (RE.moodGood.test(message)) return { text: moodGoodAnswer(), intent: "mood" };
  if (RE.moodBad.test(message)) return { text: moodBadAnswer(), intent: "mood" };
  if (RE.yes.test(message)) {
    return {
      text: yesAnswer(resolveLastTopic(ctx.chatId, ctx.history ?? [])),
      intent: "confirmation",
    };
  }
  if (RE.no.test(message)) return { text: noAnswer(), intent: "decline" };

  /* ---------- 1) topical matching ------------------------------------ */
  const ranked = scoreAll(message);
  const matches = ranked.filter((r) => r.score >= MATCH_THRESHOLD);

  /* Explicit study-planning questions ("how do I start", "study plan")
     pre-empt lessons — unless a real topic (not the generic NLP intro
     card) matched strongly, or an exam/quiz lane is clearly in play. */
  const nonIntroMatch = ranked.find(
    (r) => r.score >= MATCH_THRESHOLD && r.card.id !== "intro",
  );
  if (
    !nonIntroMatch &&
    RE.roadmap.test(message) &&
    !RE.exam.test(message) &&
    !RE.practice.test(message) &&
    !RE.code.test(message)
  ) {
    return { text: roadmapPointerAnswer(), intent: "roadmap-point" };
  }

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
        return { text: compareFromTable(curated), intent: "compare" };
      }
      const second = matches.find((m) => m.card.id !== best.card.id);
      if (second) {
        rememberTopic(ctx.chatId, best.card);
        return { text: genericCompare(best.card, second.card), intent: "compare" };
      }
      // fall through to normal topic treatment if only one card matched
    }

    rememberTopic(ctx.chatId, best.card);

    /* quiz page pointer */
    if (RE.quizPage.test(message) && !RE.practice.test(message)) {
      return { text: quizPointerAnswer(best.card), intent: "quiz-point" };
    }

    /* topical answers with modifiers */
    if (followupKind === "code") return { text: codeAnswer(best.card), intent: "code" };
    if (followupKind === "practice") return { text: practiceAnswer(best.card), intent: "practice" };
    if (followupKind === "exam") {
      // "Generate important NLP exam questions" only matches the generic
      // intro card — the general exam sheet reads better than one topic's.
      const text = best.card.id === "intro" ? generalExamAnswer() : examAnswer([best.card]);
      return { text, intent: "exam" };
    }
    if (followupKind === "simple") return { text: simpleAnswer(best.card), intent: "simple" };
    if (followupKind === "example") return { text: exampleAnswer(best.card), intent: "example" };
    if (followupKind === "detail" || RE.deepish.test(message)) {
      return { text: fullLesson(best.card), intent: "lesson" };
    }
    return { text: quickAnswer(best.card), intent: "lesson" };
  }

  /* ---------- 2) follow-ups riding on the last topic ------------------ */
  if (RE.reveal.test(message)) {
    const last = resolveLastTopic(ctx.chatId, ctx.history ?? []);
    return { text: revealAnswer(last), intent: "reveal" };
  }
  if (RE.quizPage.test(message)) {
    return { text: quizPointerAnswer(null), intent: "quiz-point" };
  }
  if (followupKind) {
    const last = resolveLastTopic(ctx.chatId, ctx.history ?? []);
    if (followupKind === "exam" && !last) {
      return { text: generalExamAnswer(), intent: "exam" };
    }
    if (last) {
      rememberTopic(ctx.chatId, last);
      switch (followupKind) {
        case "code":
          return { text: codeAnswer(last), intent: "code" };
        case "practice":
          return { text: practiceAnswer(last), intent: "practice" };
        case "exam":
          return { text: examAnswer([last]), intent: "exam" };
        case "simple":
          return { text: simpleAnswer(last), intent: "simple" };
        case "example":
          return { text: exampleAnswer(last), intent: "example" };
        case "detail":
          return { text: fullLesson(last), intent: "lesson" };
      }
    }
    return { text: needTopicAnswer(followupKind), intent: "need-topic" };
  }

  /* ---------- 3) pure conversation ----------------------------------- */
  if (RE.glossary.test(message)) {
    return { text: glossaryPointerAnswer(), intent: "glossary-point" };
  }
  if (RE.capabilities.test(message)) {
    return { text: capabilitiesAnswer(), intent: "capabilities" };
  }
  if (RE.identity.test(message)) return { text: identityAnswer(), intent: "identity" };
  if (RE.topicsList.test(message)) return { text: topicsAnswer(), intent: "topics" };
  if (RE.howAreYou.test(message)) return { text: howAreYouAnswer(), intent: "conversation" };
  if (RE.aboutYou.test(message)) return { text: aboutYouAnswer(), intent: "conversation" };
  if (RE.thanks.test(message)) return { text: thanksAnswer(), intent: "conversation" };
  if (RE.smalltalk.test(message)) return { text: smalltalkAnswer(), intent: "conversation" };
  if (RE.offTopic.test(message)) return { text: offTopicAnswer(), intent: "off-topic" };

  /* ---------- 4) unknown --------------------------------------------- */
  return { text: unknownAnswer(ranked, message), intent: "unknown" };
}

/** Text-only view kept for compatibility (tests, callers that ignore intent). */
export function composeOfflineAnswer(ctx: OfflineContext): string {
  return composeOffline(ctx).text;
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
