/**
 * Offline NLP knowledge base used by the built-in tutor engine.
 * Each card is a structured lesson: the engine composes answers
 * (full lesson / quick answer / code / comparison / follow-up) from these
 * fragments, so the same card serves many question styles.
 */

export interface TopicCard {
  id: string;
  title: string;
  /** one-line essence, also used in comparison tables */
  short: string;
  /** regex (case-insensitive) matching common phrasings */
  keywords: string;
  definition: string;
  intuition: string;
  steps: string[];
  example: string;
  /** what situations/paradigms it fits — used in comparison tables */
  useWhen: string;
  code?: { install: string; code: string; output: string; note: string };
  pros: string[];
  cons: string[];
  mistakes: string[];
  examNotes: string[];
  practice: string;
}

export const TOPIC_CARDS: TopicCard[] = [
  {
    id: "intro",
    title: "Introduction to NLP and real-world applications",
    short: "Making computers understand and generate human language",
    keywords: "what is nlp|natural language processing|intro\\b.*nlp|nlp applications|uses? of nlp|where is nlp used|real[- ]world applications",
    definition:
      "**NLP** is the field of AI that makes computers understand, analyse and generate human language — from raw text (or speech transcripts) to useful actions like translation, tagging or answering questions.",
    intuition:
      "Language looks simple but hides traps: \"not bad\" can be positive, \"cheap cheap cheap\" is a spam signal rather than adjective corn, and \"book a flight\" vs \"read a book\" flips the word's role. NLP handles this with hand-crafted rules (the classical era: tokenizers, grammars, TF-IDF), then statistics (embeddings, HMMs), and now deep learning (Transformers, LLMs).",
    steps: [
      "Raw input arrives: text document, chat message, search query, PDF.",
      "Text preprocessing and tokenization convert it into processing units.",
      "Representations turn tokens into numbers (TF-IDF vectors or embeddings).",
      "A model maps numbers to labels, tags, translations or more text.",
      "Evaluation metrics (F1, BLEU, perplexity) decide how good the output produced is.",
      "The system is deployed behind software APIs with monitoring for bias and drift.",
    ],
    example:
      "YouTube auto-captions: audio → speech-to-text tokens → punctuation + capitalization model → searchable video transcript. Google Translate: source sentence → subword tokens → encoder → decoder → target sentence.",
    useWhen: "Understanding what stage of the classic pipeline a task belongs to",
    pros: [
      "Automates language-heavy work at scale (search, tagging, translation)",
      "Classic pipeline is transparent and cheap to run",
      "Modern models transfer across many tasks with little data",
    ],
    cons: [
      "Ambiguity (sarcasm, coreference, idioms) still confuses systems",
      "Quality depends hugely on the training data distribution",
      "Modern accuracy costs real compute for serving",
    ],
    mistakes: [
      "Believing an NLP system 'understands' like a human — it computes statistics over representations",
      "Skipping the evaluation step and shipping on vibes",
    ],
    examNotes: [
      "Recite the classic pipeline: preprocessing → tokenization → features → model → evaluation → deployment",
      "Name one classical and one modern approach for the same task (e.g. rule-based tagging vs BERT tagging)",
      "Give three real applications: machine translation, email spam filtering, virtual assistants",
    ],
    practice: "Which stage goes wrong when a search engine cannot find 'running shoes' in a page that only says 'runners jog in sneakers'?",
  },
  {
    id: "preprocessing",
    title: "Text preprocessing, cleaning normalization and Unicode",
    short: "Turning messy raw text into clean consistent input",
    keywords: "preprocess|cleaning|normaliz|normalis|unicode|lowercas|noise removal|text cleaning|accent",
    definition:
      "**Text preprocessing** cleans raw text before analysis: encoding fixes, Unicode normalization, lowercasing, punctuation/whitespace handling, HTML stripping — so every algorithm sees consistent input.",
    intuition:
      "\"Café\", \"café̈\" and \"CAFÉ\" are different byte sequences for text that reads the same — and stray combining accents sneak into real scraped text. Models trained on inconsistent text silently split their learning budget across duplicates instead of learning meaning. Cleaning is boring, cheap — and decides your model's ceiling.",
    steps: [
      "Decode bytes to text with the right encoding; know your document's encoding.",
      "Unicode-normalize (NFC keeps composed é, NFKC flattens ligatures/superscripts).",
      "Strip markup/URLs/handles when the task doesn't need them (regex)",
      "Normalize case, expand contractions, unify whitespace and quotes.",
      "Decide: keep or drop stop words, punctuation, accents — depending on the downstream task.",
    ],
    example:
      "Email 453 mentions 'iOS 17…' while training data says 'ios 17': case folding unifies them, but the same folding hurts NER where 'iOS' vs 'ios' is signal about the brand.",
    useWhen: "The first stage of any text pipeline; wrong choices here poison everything downstream",
    code: {
      install: "standard library — no installation needed",
      code: `# pip install unicodedata2  # extras; stdlib has 'unicodedata'
import re
import unicodedata

raw = "Café  Café... café́     http://x.co  #fun"
step1 = unicodedata.normalize("NFKC", raw)
step2 = re.sub(r"https?://\\S+", "", step1)      # strip URLs
step3 = re.sub(r"#\\w+", "", step2)               # strip hashtags
step4 = re.sub(r"\\s+", " ", step3).strip().lower()
print(step4)`,
      output: "café café café",
      note: "NFKC flattens é variants and full-width characters; the regexes cut noise without touching letters.",
    },
    pros: [
      "Reduces vocabulary noise so models learn sharper patterns",
      "Huge accuracy gains for rule-based and classic ML pipelines",
      "Cheap: regex/unicode work is microseconds per document",
    ],
    cons: [
      "Over-cleaning deletes signal (case for NER, punctuation for sentiment)",
      "Language-specific rules don't transfer directly",
      "Cleaning bugs are silent — nothing crashes, results just get worse",
    ],
    mistakes: [
      "Lowercasing before NER",
      "Applying one cleaning script to many languages with different scripts/punctuation",
      "Forgetting to apply the SAME cleaning at inference time",
    ],
    examNotes: [
      "NFC vs NFKC: NFC keeps composed forms; NFKC further decomposes ligatures and compat forms",
      "Explain why cleaning decisions are task-dependent with one example (sentiment keeps '!', NER keeps case)",
      "Know what a BOM is and why 'encoding=\"utf-8\"' stops mojibake",
    ],
    practice: "You see 'ï»¿' at the start of a file read by Python. What is it and how do you fix it?",
  },
  {
    id: "tokenization",
    title: "Tokenization (sentence, word and subword)",
    short: "Splitting text into the units a model actually processes",
    keywords: "tokeniz|tokenis|tokenizer|subword|bpe|wordpiece|sentencepiece|\\bpunkt\\b|\\bunk\\b|vocabulary",
    definition:
      "**Tokenization** splits raw text into *tokens* — sentences, words or subword pieces — which become the basic units every later stage (vocabularies, embeddings, transformers) consumes.",
    intuition:
      "A model can only compute with a fixed vocabulary. Word-level vocabularies explode (~500k+ words, misspellings, new slang) and hit the <UNK> wall; character level is too fine; subwords (BPE/WordPiece/SentencePiece) merge the most frequent fragments so a bounded ~30k vocab still represents any word: 'unaffordable' → un + afford + able.",
    steps: [
      "Choose a level: sentence / word / character / subword.",
      "Word level: split on whitespace+punctuation, keep contractions sane ('isn't' → is + n't).",
      "Sentence level: detect boundaries with rules or a sentence splitter like punkt (handles 'Dr.') too.",
      "Subword: learn merges from a corpus (BPE) or pick a vocab that maximizes likelihood (WordPiece/Unigram).",
      "Map tokens to integer ids, prepend/prepend special tokens like [CLS]/[SEP] or <s> when the model needs them.",
    ],
    example:
      "Text: 'Unaffordable!!' → character level: U n a f f o r d a b l e ! ! ; word level: Unaffordable ! ! ; subword: un, afford, able, !.",
    useWhen: "Every text task starts here; tokenizer choice exactly matches the pretrained checkpoint",
    code: {
      install: "pip install nltk transformers",
      code: `import nltk
nltk.download("punkt_tab", quiet=True)
from nltk.tokenize import sent_tokenize, word_tokenize

text = "Dr. Chen didn't reply. Vector search is fast!"
print(sent_tokenize(text))
print(word_tokenize(text))

from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("bert-base-uncased")
print(tok.tokenize("unaffordable"))
print(tok.convert_tokens_to_ids(tok.tokenize("unaffordable")))`,
      output: `["Dr. Chen didn't reply.", "Vector search is fast!"]
['Dr.', 'Chen', 'did', "n't", 'reply.', 'Vector', 'search', 'is', 'fast', '!']
['un', '##afford', '##able']
[4895, 14228, 2673]  # ids vary by vocab version — don't memorize them`,
      note: " punkt_tab is NLTK's sentence splitter data; convert_tokens_to_ids shows how ids come from a specific checkpoint's vocabulary.",
    },
    pros: [
      "Subwords give bounded vocabularies with no unknown words",
      "Word tokens remain interpretable for analysis",
      "Character level languages-agnostic (Chinese, code, misspellings)",
    ],
    cons: [
      "Naive whitespace splitting breaks URLs, contractions, emojis",
      "Word level UNK problem and vocab explosion",
      "The tokenizer MUST match the pretrained model's exactly or embeddings become meaningless",
    ],
    mistakes: [
      "Forgetting nltk.download() data packs before tokenizing",
      "Calling tok.tokenize() without also applying special tokens (use tok() directly in transformers)",
    ],
    examNotes: [
      "BPE = merge most frequent adjacent pair iteratively; WordPiece marks continuation pieces with '##'",
      "Why vocab must match the checkpoint: ids index into that model's embedding matrix",
      "Sentence vs word vs subword with one example each is a 3-mark classic",
    ],
    practice: "Tokenize 'UNESCO% renormalizing??' (a) NLTK word level (b) WordPiece. Which pieces show the '##' pattern and why?",
  },
  {
    id: "regex",
    title: "Regular expressions and text extraction",
    short: "Declarative pattern matching to find, extract and restructure text",
    keywords: "regex|regular expression|re\\.\\b|extract (emails?|urls?|numbers?|dates)|pattern matching|\\bfindall\\b|greedy",
    definition:
      "A **regular expression** is a declarative pattern language: character classes, quantifiers, groups and anchors that match substrings, enabling find/extract/replace operations over text.",
    intuition:
      "Before any fancy model, half of data-wrangling is regex: pull emails from web pages, normalise dates, split on delimiters. It's deterministic, free, instant — perfect when the pattern is known. It only breaks for recursive structure (nested brackets, HTML/XML — never parse those with regex).",
    steps: [
      "Express what to match with classes ([0-9], \\w, \\s) and quantifiers (+, *, {m,n}).",
      "Anchor with \\b (word boundary), ^/$ (start/end) to control where matches sit.",
      "Group with ( ) ; named groups (?P<name>...) make extraction readable.",
      "Escaping backslashes needs raw strings (r'...') in Python.",
      "Use findall/finditer to extract, sub to replace, split to cut; test on edge cases.",
    ],
    example:
      "From 'Write to u07234@univ.in or visit https://notes.example.edu/unit3' — email regex '[\\w.+-]+@[\\w-]+\\.[\\w.-]+' returns 'u07234@univ.in'; URL regex 'https?://\\S+' returns the link.",
    useWhen: "Deterministic structured extraction — IDs, phones, dates, log lines; also quick cleaning",
    code: {
      install: "standard library — no installation needed",
      code: `import re

text = "Write to me at u07234@univ.in or see https://nlp-notes.example.edu/unit3"
emails = re.findall(r"[\\w.+-]+@[\\w-]+\\.[\\w.-]+", text)
urls   = re.findall(r"https?://\\S+", text)
ids    = re.findall(r"\\b[A-Za-z]{2}\\d{5}\\b", text)
clean  = re.sub(r"\\s{2,}", " ", "a   b    c")

print(emails); print(urls); print(ids); print(clean)`,
      output: `['u07234@univ.in']
['https://nlp-notes.example.edu/unit3']
['u07234']
a b c`,
      note: "Raw strings avoid escaping pain; re.I adds case-insensitivity; be aware ., ? and * are special and must be escaped to match literally.",
    },
    pros: [
      "Zero training data; exact and fast",
      "Universal: every language and editor supports it",
      "Great first pass before ML: annotation candidates, cleaning, parsing logs",
    ],
    cons: [
      "Cannot handle nested/recursive structure (HTML parsing with regex is a smell)",
      "Complex patterns become unreadable and brittle",
      "Catastrophic backtracking on nested quantifiers like (.+)+",
    ],
    mistakes: [
      "Forgetting raw strings r'' and fighting '\\\\' vs '\\'",
      "Greedy .* swallowing too much — prefer non-greedy .*? or precise classes",
    ],
    examNotes: [
      "Quantifiers: ? zero-or-one, * zero-or-more, + one-or-more, {m,n} bounded",
      "Greedy vs lazy matching and how .*? changes extraction",
      "\\b, ^, $ anchors and named groups (?P<x>\\d+) in extraction code",
    ],
    practice: "Write a regex matching dates like 25-03-2024 and 5.11.2023 but not 2024-25-03. Which groups make rearrangement possible?",
  },
  {
    id: "stopwords",
    title: "Stop-word removal",
    short: "Dropping very frequent function words to cut noise",
    keywords: "stop words?|stopword|remove common words|filter words",
    definition:
      "**Stop words** are extremely frequent function words ('the', 'is', 'of') that historically got removed to reduce dimensionality and noise.",
    intuition:
      "If every document contains 'the, of, is', those tokens can't tell documents apart — classic IR dropped them for storage savings and precision. But modern models keep them: BERT needs 'not' and 'the' to compute negation and grammar. Removing is a classic-ML optimisation, not a law.",
    steps: [
      "Tokenize the text first (order matters!).",
      "Load a curated stop list (nltk.corpus.stopwords, sklearn's ENGLISH_STOP_WORDS).",
      "Filter tokens before feature extraction (only if the task benefits).",
      "Mind built-in language knowledge: model vocabularies like BERT's include stop words by design.",
    ],
    example:
      "'The acting was not good' → with stop word removal + no n-grams: 'acting good' — positive! That's why sentiment keeps negators or uses bigrams/transformers.",
    useWhen: "Small models, keyword search, topic modelling on big corpora",
    pros: ["Fewer dimensions, faster training", "Less domination by ultra-frequent words", "Crisper keyword search results"],
    cons: ["Destroys negation and grammar ('not', 'no')", "Static lists are task-blind", "Useless for pretrained transformers"],
    mistakes: ["Removing stop words then computing sentiment with unigram models", "Not lowercasing first so 'The' escapes the filter"],
    examNotes: [
      "Define stop words + one example of harm ('not' in sentiment)",
      "When removal helps (BoW search) vs hurts (transformers, negation)",
    ],
    practice: "Should a BERT-based sentiment system remove stop words? Justify in one line.",
  },
  {
    id: "stemming",
    title: "Stemming and lemmatization",
    short: "Rough rule-cut stems vs dictionary-correct lemmas",
    keywords: "stemming|\\bstem\\b|lemmatiz|lemma|porter|snowball|wordnet lemmatizer|inflection",
    definition:
      "**Stemming** chops affixes with suffix rules ('studies'→'studi'); **lemmatization** maps a word to its dictionary base form using morphology and POS context ('was'→'be', 'better'→'good').",
    intuition:
      "Stemming is a machete — fast, rough, sometimes not even a real word ('geese'→'gee'). Lemmatization is a scalpel — slower, needs a lexicon plus the word's grammatical role, but yields real words your analysis can trust.",
    steps: [
      "Pick the tool: Porter/Snowball stemmer vs WordNet lemmatizer / spaCy lemmas.",
      "Tokenize first; decide whether to lowercase.",
      "For lemmatization, supply POS context (spaCy does it via the tagger).",
      "Apply uniformly to index terms (search) or analysis (chatbots).",
      "Rarely used for state-of-the-art classifiers — subword models absorb inflection.",
    ],
    example:
      "'studies, studying, studied' → Porter: studi, studi, studi (one rough stem) · lemmatization: study, study, study (one real word). 'geese' stays 'geese' under lemmatization, becomes 'gees' under Porter.",
    useWhen: "Search/IR (stem with speed), linguistic analysis/chatbots (lemmatize with precision)",
    code: {
      install: "pip install nltk",
      code: `import nltk
nltk.download(["wordnet", "omw-1.4"], quiet=True)
from nltk.stem import PorterStemmer, WordNetLemmatizer

words = ["studies", "flies", "geese", "better", "was"]
stemmer = PorterStemmer()
lem = WordNetLemmatizer()

print([stemmer.stem(w) for w in words])
print([lem.lemmatize(w) for w in words])          # default noun
print([lem.lemmatize(w, "v") for w in words])     # verb context`,
      output: `['studi', 'fli', 'gee', 'better', 'wa']
['study', 'fly', 'geese', 'better', 'wa']
['studi', 'fly', 'geese', 'better', 'be']   # 'was' only fixes as a verb`,
      note: "POS matters: lemmatize('flying','v') → 'fly' but as a noun it stays 'flying'; spaCy resolves POS automatically.",
    },
    pros: [
      "Stemming: extremely fast, no data needed, boosts recall in search",
      "Lemmatization: produces valid words, respects irregular forms",
      "Both shrink sparsity in classical feature spaces",
    ],
    cons: [
      "Stemming can over/under-stem ('university'/'universe' collide or stay split)",
      "Lemmatization slower, needs POS + lexicon coverage",
      "Neither needed for modern transformer models (subwords handle it)",
    ],
    mistakes: [
      "Expecting Porter output to always be an English word",
      "Lemmatizing without POS and trusting ambiguous results",
    ],
    examNotes: [
      "Define each + one example contrast ('studies' → 'studi' vs 'study')",
      "Terms: over-stemming vs under-stemming",
      "Lemmatization requires morphological analysis (WordNet) — exam keyword",
    ],
    practice: "Apply Porter + WordNet (verb) to 'running, stories, was, geese'. Which mismatches surprise you and why?",
  },
  {
    id: "ngram",
    title: "N-gram language models and probability",
    short: "Predicting the next word from counts of the previous n-1 words",
    keywords: "n-?gram|bigram|trigram|language model|perplexity|smoothing|laplace|markov",
    definition:
      "An **N-gram language model** estimates P(wₙ | w₁…wₙ₋₁) ≈ P(wₙ | wₙ₋ₙ₊₁…wₙ₋₁) using corpus counts — the Markov assumption that only the last few words matter.",
    intuition:
      "You can't count full-sentence probabilities (nothing repeats). Approximating with trigrams makes counting tractable — and gave speech systems their first decent predictors. The catch: any trigram unseen in the corpus gets probability **zero**, so smoothing (Laplace, Kneser-Ney) redistributes mass to unseen events.",
    steps: [
      "Tokenize and count every bigram/trigram (with START and END sentinels).",
      "Estimate P(wᵢ|wᵢ₋₁) = count(wᵢ₋₁,wᵢ)/count(wᵢ₋₁) — the maximum-likelihood estimate.",
      "Handle zero counts by smoothing: add-k (Laplace) or Kneser-Ney interpolation.",
      "Score a sentence: multiply conditional probabilities (sum log-probs).",
      "Report perplexity = 2^(average negative log₂ probability) — lower is better.",
    ],
    example:
      "Trained on 'the cat sat' and 'the cat ran': P(ran|the cat) = 1/2. P(dog|the cat) with Laplace add-1 smoothing becomes (0+1)/(2+V) — small, never zero.",
    useWhen: "Historical speech/OCR/KWS systems; simple autocomplete; still the standard eval baseline",
    pros: ["Simple, fast, interpretable counts", "No labels needed — unsupervised from text", "Smoothing math is well understood and exam-friendly"],
    cons: ["Exponentially many parameters as n grows", "Cannot capture long-range dependencies", "Zero-count problem forces smoothing"],
    mistakes: ["Forgetting the Markov assumption in the definition", "Reporting raw probabilities instead of perplexity comparisons across identical tokenization"],
    examNotes: [
      "Bigram P(B|A) = count(A,B)/count(A); know both MLE and add-k formulas",
      "Perplexity = inverse probability of the test set, normalized per word; lower = better",
      "Why smoothing is necessary (unseen bigrams) — one example",
    ],
    practice: "Corpus counts: P('data'|'big') = 3/10. With V=500 and add-1 smoothing, what is the new probability? Show the calculation.",
  },
  {
    id: "pos",
    title: "Part-of-speech tagging",
    short: "Assigning grammatical categories (noun, verb, …) to each token",
    keywords: "\\bpos\\b|part of speech|tagging|tagger|verb phrase tag|hmm.*tag|viterbi",
    definition:
      "**POS tagging** labels every token with its grammatical category (NOUN, VERB, ADJ, ADV, PRON...) in context — 'book' is a NOUN in 'read the book', a verb in 'book a flight'.",
    intuition:
      "Same word, different syntax — a tagger disambiguates with context. Classically a Hidden Markov Model with Viterbi decoding picked the best tag sequence; today's taggers are neural sequence models trained on annotated corpora (PTB, OntoNotes).",
    steps: [
      "Tokenize the sentence; optionally lemmatize downstream.",
      "Run a pretrained tagger (spaCy en_core_web_sm, NLTK perceptron tagger).",
      "Tags drive lemmatization (flying→fly), chunking, and entity features.",
      "Evaluate with per-tag accuracy (rare tags need weighted metrics).",
    ],
    example:
      "Book → NOUN in 'I read a book quickly'; QUICKLY → ADV; compare 'book a flight' where book → VERB — same sentence pattern, different syntax thanks to the surrounding words.",
    useWhen: "Foundation for parsing, chunking, and linguistics-aware features",
    code: {
      install: "pip install spacy && python -m spacy download en_core_web_sm",
      code: `import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("I book a flight at the counter quickly.")

for token in doc:
    print(token.text, token.tag_, token.pos_)

# the same token, different POS:
print([t.pos_ for t in nlp("I read a book quickly.")])`,
      output: `I PRP PRON
book VB VERB
flight NN NOUN
counter NN NOUN
quickly RB ADV
['PRON', 'VERB', 'DET', 'NOUN', 'ADV']   # 'book' changes role with context`,
      note: "tag_ is the fine-grained Penn tag (VB, NN); pos_ is the universal category (VERB, NOUN).",
    },
    pros: ["Improves lemmatization, chunking, syntactic parsing", "Cheap discriminative signal for classic features", "Trained taggers are tiny and CPU-fast"],
    cons: ["Domain shift hurts (tweets, code, legal jargon)", "Ambiguous rare words get mis-tagged", "Transformers often don't need explicit tags at all"],
    mistakes: ["Assuming tags transfer across corpora/tag sets (PTB vs universal)", "Tagging without tokenization consistency with the next stage"],
    examNotes: [
      "HMM + Viterbi: transition/emission probabilities decoded per best tag path",
      "Ambiguity example: 'book' as noun vs verb",
      "POS tagger downstream effect: better lemmatization/chunking",
    ],
    practice: "In 'Time flies like an arrow', what POS should 'flies' have? What does ambiguity even mean for a tagger here?",
  },
  {
    id: "ner",
    title: "Named Entity Recognition (NER)",
    short: "Finding and classifying people, places, organisations, dates",
    keywords: "\\bner\\b|named entity|entities? recognition|\\bbio\\b|entity extraction|person.*org|extract entities",
    definition:
      "**NER** detects spans that name real-world entities (people, orgs, locations, dates, money...) and labels each with a type, typically using BIO tagging: B-PER I-PER O.",
    intuition:
      "Sentence 'Tim Cook met Sundar Pichai in Bangalore' must spot two PERSONs, one GPE and know 'Tim Cook' is one token-pair, not two people. Sequence tagging (BIO) + the context of surrounding words solves this; modern systems are fine-tuned BERT token classifiers, classic ones CRFs/HMMs over gazetteer features.",
    steps: [
      "Tokenize and (for BIO) assign B-/I-/O- labels per token.",
      "Run a pretrained model (spaCy en_core_web_sm or a HF token-classification pipeline).",
      "Merge consecutive same-entity tokens into spans (doc.ents does this for you).",
      "Evaluate per entity type with precision/recall/F1 (partial overlap counts wrong).",
    ],
    example:
      "'Apple hired a New York engineer' → Apple ORG · New York GPE. In 'the apple was sweet' → no entity: context resolves brand vs fruit.",
    useWhen: "Information extraction, resume parsing, redaction, knowledge graphs",
    code: {
      install: "pip install spacy && python -m spacy download en_core_web_sm",
      code: `import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("Tim Cook announced a partnership between Apple and IISc Bangalore on 25 March 2024.")

for ent in doc.ents:
    print(ent.text, "|", ent.label_, "| chars", ent.start_char, "-", ent.end_char)`,
      output: `Tim Cook | PERSON | chars 0-8
Apple | ORG | chars 40-45
IISc Bangalore | ORG | chars 50-63
25 March 2024 | DATE | chars 65-78`,
      note: "Labels vary slightly across model versions (GPE vs LOC) — never hard-code assumptions.",
    },
    pros: ["Blocks structured facts from unstructured text", "SpaCy pipelines run on CPU", "Custom domains fine-tune quickly from a few hundred labelled sentences"],
    cons: ["Annotated corpora underrepresent names/communities → demographic bias", "Tricky in informal text (no caps, misspelling)", "Nested entities (org inside org) need special models"],
    mistakes: ["Trusting dates/numbers exactly — DATE vs MONEY boundary errors are common", "Reporting only micro-F1 and missing that one entity type fails"],
    examNotes: [
      "BIO scheme definition + a two-token entity example",
      "Evaluation with entity-level precision/recall (not token accuracy)",
      "Classic: CRF over word-shape/gazetteer features; modern: BERT token classification",
    ],
    practice: "Tag BIO for 'New Delhi hosts the AI Summit 2024.' Which tokens are B- and which are I-?",
  },
  {
    id: "parsing",
    title: "Constituency and dependency parsing",
    short: "Syntactic trees (S→NP VP) vs head-modifier links between words",
    keywords: "pars(er|ing)|constituen|dependency (parse|grammar|tree)|syntactic tree|syntax tree|cfg|universal dependencies",
    definition:
      "Constituency parsing builds a phrase-structure tree (S → NP VP → ...) from a grammar; dependency parsing links each word directly to its grammatical head with labelled relations.",
    intuition:
      "Same sentence, two views: constituency says 'the dog' is an NP inside the VP (structure), dependency says 'dog' is nsubj of 'chased' (relations). Dependency trees are flatter and easier to query; constituency trees are what grammar textbooks draw.",
    steps: [
      "Tokenize + POS-tag (parsers need lexical categories).",
      "Constituency: a CKY/PCFG algorithm assembles the best-scoring tree (NLTK's chart parser).",
      "Dependency: shift-reduce/graph-based models attach heads with relations (nsubj, dobj, amod, advmod).",
      "Read the output: spaCy documents show dependency labels with token.head_ and token.dep_.",
    ],
    example:
      "'She reads novels' — dependency: reads as root; She ①nsubj(reads); novels ②dobj(reads). Constituency: S = NP(She) + VP(reads, NP(novels)).",
    useWhen: "Grammar QA, relation extraction, grammar correction, linguistics teaching",
    code: {
      install: "pip install spacy && python -m spacy download en_core_web_sm",
      code: `import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("The quick fox jumps over the lazy dog.")

for token in doc:
    print(token.text, token.dep_, token.head.text)`,
      output: `The det fox
quick amod fox
fox nsubj jumps
jumps ROOT jumps
over prep jumps
the det dog
lazy amod dog
dog pobj over
. punct jumps`,
      note: "dep_ is the relation to head; head points at the governing token (jumps is ROOT).",
    },
    pros: ["Direct route from text to logical structure", "Dependency trees ease information extraction", "Visual + queryable for grammar-based apps"],
    cons: ["State-of-the-art parsers are slow on CPU", "Domain shift wrecks accuracy", "Deep trees add little for modern transformer tasks that don't need syntax"],
    mistakes: ["Feeding untokenized raw text to a parser", "Confusing dependency head relations with phrase structure rules"],
    examNotes: [
      "Contrast formalisms: phrasal hierarchy (constituency) vs dependency head-relation links",
      "Name 4 dependency labels with meaning (nsubj, dobj, amod, advmod)",
      "PCFG scores rule expansions probabilistically (classic exam point)",
    ],
    practice: "Draw (text-tree) the dependency links of 'The quick fox jumps over the lazy dog' — which word is ROOT?",
  },
  {
    id: "syntax",
    title: "Syntax, semantics and discourse",
    short: "The three levels of meaning analysis: structure, meaning, context",
    keywords: "syntax.*semant|semant.*syntax|anaphora|coreferenz|discourse|ellipsis|word sense|ambiguity|pragmat|word sense disambiguation",
    definition:
      "**Syntax** studies structural rules (word order, phrases); **semantics** studies literal meaning (word senses, truth conditions); **discourse** studies meaning across sentences (anaphora, ellipsis, topic flow).",
    intuition:
      "'The trophy doesn't fit the suitcase because it is too big/bag' — same sentence, different referent for 'it'. Syntax alone can't resolve it: semantics (what fits into what) and discourse (what was mentioned lately) must cooperate. That's why meaning-level NLP is harder than tagging.",
    steps: [
      "Syntax: phrase grammar determines who did what to whom in surface form.",
      "Semantics: word-sense disambiguation, semantic roles (agent/patient), predicate logic.",
      "Discourse: coreference chains ('it', 'she'), bridging, discourse relations (because/however/then).",
      "Pragmatics (context + world knowledge) sits on top — intent and implicature.",
    ],
    example:
      "Syntax makes 'Colorless green ideas sleep furiously' grammatical; semantics flags it as nonsense; discourse explains why 'they' in the next sentence refers to 'ideas' via anaphora.",
    useWhen: "Design decisions for QA, dialogue systems, summarization coherence",
    pros: ["Frame for explaining WHY systems fail (grammar vs meaning vs context)", "Guides which features/annotations a task needs", "Coreference quality decides summarization/QA coherence"],
    cons: ["Ambiguity makes perfect semantic analysis undecidable-ish", "Discourse needs long context", "Formal logic rarely scales to noisy text"],
    mistakes: ["Claiming parsers solve meaning — they only solve structure", "Ignoring anaphora when assembling multi-sentence answers"],
    examNotes: [
      "Define syntax, semantics, discourse with one example sentence each",
      "Anaphora vs cataphora; Winograd-schema style examples",
      "Word-sense ambiguity example: 'bank' of river vs finance",
    ],
    practice: "In 'Ravi greeted Sunil. He smiled.' — who is 'He'? What knowledge must an NLP system use to decide?",
  },
  {
    id: "tfidf",
    title: "Bag of Words, one-hot encoding and TF-IDF",
    short: "Sparse frequency-based text representations",
    keywords: "tf-?idf|bag of words|\\bbow\\b|one-?hot|sparse vector|term frequency|inverse document frequency",
    definition:
      "**One-hot** marks each word with a single 1 in a huge sparse vector; **Bag of Words** counts occurrences; **TF-IDF** weights each term by its in-document frequency times its corpus-level rarity.",
    intuition:
      "A word that appears in every document ('the') tells you nothing — IDF drives its weight to ~0. A word frequent in ONE doc ('tokenization' in an NLP note) gets a big weight. TF-IDF = local frequency × global rarity. It's still the fastest sensible first baseline for search and linear text classifiers.",
    steps: [
      "Fix the vocabulary from training documents (fit vectorizer only there).",
      "Count term frequencies per doc (BoW) or let TfidfVectorizer do tf weighting.",
      "Compute idf(t) = log(N/(1 + df_t)) + 1 (sklearn's smoothed form keeps weights positive).",
      "Multiply and (optionally) L2-normalise each document vector.",
      "Feed the sparse matrix to LogisticRegression / SVM, or compare docs by cosine similarity.",
    ],
    example:
      "Corpus 1000 docs: 'tokenization' tf=0.1, idf=log(1000/9)≈6.8 → weight ≈ 0.68; 'the' idf≈small → automatically down-weighted.",
    useWhen: "Search ranking, keyword extraction, linear classifier baselines, document similarity",
    code: {
      install: "pip install scikit-learn",
      code: `from sklearn.feature_extraction.text import TfidfVectorizer

corpus = [
    "The transformer uses attention instead of recursion",
    "Attention lets the transformer focus on tokens",
    "Vector retrieval matches tf-idf weighted documents",
]
vec = TfidfVectorizer(ngram_range=(1, 2))
X = vec.fit_transform(corpus)
print(X.shape)

q = vec.transform(["attention mechanism"])
scores = (X @ q.T).toarray().ravel()
for doc, score in zip(corpus, scores):
    print(f"{score:.2f}  {doc[:40]}")`,
      output: `(3, 30)                      # sparse: vocab ~30 with bigrams
0.70  The transformer uses attention i...
0.85  Attention lets the transformer fo...
0.00  Vector retrieval matches tf-idf w...   # no overlap → 0`,
      note: "Scores relative; exact values depend on smoothing and normalization — reason, don't memorise.",
    },
    pros: ["Training-free, ultra-fast, CPU-only", "Interpretable: each weight maps to a term", "Strong linear baselines for many tasks"],
    cons: ["Bag-of-words: ignores order/negation/semantics", "Vocabulary grows with corpus — sparse and memory hungry", "Rarer-term weighting misleads short queries without doc length normalization"],
    mistakes: [
      "Fitting the vectorizer on train AND test data (leakage) — fit only on train",
      "Comparing raw scores across corpora tokenized differently",
    ],
    examNotes: [
      "Write tf-idf = tf(t,d) × log(N/(1+df)) and justify the +1 smoothing",
      "Numerical: given tf/idf compute weight",
      "BoW vs TF-IDF vs embeddings: frequency vs rarity vs semantic closeness",
    ],
    practice: "tf=3/30, idf=log₂(10) → weight? Why can smoothed idf never be negative with sklearn's formula?",
  },
  {
    id: "embeddings",
    title: "Word embeddings: Word2Vec, GloVe and contextual embeddings",
    short: "Dense vectors where geometric distance encodes meaning",
    keywords: "embedding|word2vec|skip-?gram|cbow|negative sampling|glove|fasttext|static.*vector|dense vector",
    definition:
      "A **word embedding** is a dense vector (50–1024 dims) learned so words used in similar contexts end up near each other (cosine similarity) — 'cat' ≈ close to 'dog' but far from 'car'.",
    intuition:
      "One-hot gives every pair of words the same distance (useless). Word2Vec (Skip-gram predicts neighbours from a center word; CBOW the reverse; negative sampling replaces a giant softmax with ~5–20 random negatives) learns meaning from co-occurrence. GloVe trains from the global co-occurrence matrix; fastText adds n-grams for rare words. Static methods still give ONE vector per word — contextual models (BERT) give a vector per token-in-context, so 'bank' adapts.",
    steps: [
      "Choose static (Word2Vec/GloVe/fastText) vs contextual (BERT sentence encoders).",
      "For static: load pretrained weights from gensim.downloader (glove-wiki-gigaword-100).",
      "Query similarity with most_similar / cosine; test analogies like king - man + woman.",
      "For contextual: get per-token vectors with a transformer model or sentence with Sentence-BERT.",
      "Compare with cosine similarity, not Euclidean distance (direction matters).",
    ],
    example:
      "glove vectors: most_similar('king', topn=3) ≈ [queen, monarch, prince]; king − man + woman lands closest to 'queen' in most runs.",
    useWhen: "Semantic search, clustering recommendations, feature inputs to classic models",
    code: {
      install: "pip install gensim (downloads ~100 MB once for glove vectors)",
      code: `import gensim.downloader as api
model = api.load("glove-wiki-gigaword-100")

print(model.most_similar("king", topn=3))
print("cos(cat, dog) =", round(model.similarity("cat", "dog"), 3))
print(model.most_similar(positive=["king","woman"], negative=["man"], topn=1))`,
      output: `[('queen', 0.75), ('monarch', 0.71), ('prince', 0.69)]
cos(cat, dog) = 0.72
[('queen', 0.85)]
(approximate — values vary with vector version)`,
      note: "cos(u,v) = u·v / (||u|| ||v||); always mention cosine when comparing embeddings.",
    },
    pros: ["Dense ~100-dim vectors generalize where one-hot cannot", "Similarity + analogy structure appears without labels", "Pretrained vectors transfer to any downstream task"],
    cons: ["One sense per word (bank: river vs finance)", "Rare words unk in Word2Vec/GloVe (fastText fixes)", "Inherit corpus biases (gender, culture)"],
    mistakes: ["Averaging Word2Vec vectors and calling it a sentence meaning", "Using Euclidean distance on L2-unnormalized vectors from mixed sources"],
    examNotes: [
      "Skip-gram vs CBOW; negative sampling's role",
      "GloVe = global co-occurrence factorization; fastText = subword-aware",
      "Static vs contextual embeddings — one example each",
    ],
    practice: "Why can't one averaged Word2Vec vector represent 'bank' for both 'river' and 'finance'? What model fixes this and how?",
  },
  {
    id: "classification",
    title: "Text classification and sentiment analysis",
    short: "Mapping messages to labels: spam, topic, positive/negative",
    keywords: "classifi|sentiment|spam detection|topic categor|vader|emotion detection|label review",
    definition:
      "**Text classification** assigns labels to text using features (TF-IDF) with a linear model, or end-to-end with a fine-tuned transformer; **sentiment analysis** is its most famous case: the label is positive / negative / neutral (or a star rating).",
    intuition:
      "Two philosophies: classical (TF-IDF features + LogisticRegression/SVM — minutes, CPU, interpretable coefficients) and deep (fine-tuned DistilBERT — best accuracy, needs GPU time for training). Start with the baseline; upgrade only when the baseline plateaus.",
    steps: [
      "Collect labelled data; split train/val/test stratified.",
      "Baseline: TfidfVectorizer(ngram_range=(1,2)) + LogisticRegression.",
      "Evaluate with per-class precision/recall/F1 — not raw accuracy.",
      "Error-analysis: confusion matrix, wrong-sample inspection.",
      "Upgrade path: fine-tune distilBERT with AutoModelForSequenceClassification (API from transformers).",
    ],
    example:
      "'Great battery, terrible camera' — VADER lexicon scores compound ≈ 0.0 (mixes); a trained classifier learns 'great +' and 'terrible −' co-occur and predicts mixed/neutral class better.",
    useWhen: "Spam filters, review routing, intent classification, content moderation",
    code: {
      install: "pip install scikit-learn",
      code: `from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

texts = ["great battery, amazing screen", "worst purchase ever",
         "ok but camera is bad", "love the display",
         "poor sound", "decent for the price"]
labels = ["pos", "neg", "neg", "pos", "neg", "pos"]

X_tr, X_te, y_tr, y_te = train_test_split(texts, labels, test_size=0.34,
                                          stratify=labels, random_state=0)
model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
    ("lr", LogisticRegression(max_iter=1000)),
]).fit(X_tr, y_tr)

print(model.predict(["battery drains fast", "gorgeous screen"]))
print(classification_report(y_te, model.predict(X_te), zero_division=0))`,
      output: `['neg' 'pos']       # toy set, plausible predictions
precision/recall/f1 per class printed (example, not a serious benchmark)`,
      note: "stratify=labels keeps both classes in the tiny test split; with 6 examples this demo patterns, not a real system.",
    },
    pros: ["Huge practical value across domains", "Baselines are fast, auditable, cheap", "Transformers add nuance (negation, sarcasm) when data allows"],
    cons: ["Imbalanced or hard-ambiguous data wrecks naive accuracy", "Domain shift between training text and real input", "Model bias inherits from annotation choices"],
    mistakes: ["Reporting accuracy alone on imbalanced sentiment", "Leakage: fitting/evaluating on duplicates or same-author splits"],
    examNotes: [
      "VADER compound ∈ [-1, +1]; thresholds ≈ ±0.05",
      "Pipeline prevents vectorizer leakage between train/test",
      "F1 / confusion matrix over raw accuracy for imbalance justification",
    ],
    practice: "Why does a unigram bag-of-words sentiment model misread 'No, great job!'? Name two fixes.",
  },
  {
    id: "mt-summarization-qa",
    title: "Machine translation, summarization and question answering",
    short: "Generating or selecting text in other languages, shorter or as answers",
    keywords: "machine translation|translate|summariz|summaris|question answer|\\bqa\\b|abstractive|extractive|beam search",
    definition:
      "Three generation/export tasks: **MT** rewrites text into another language (seq2seq, BLEU-evaluated), **summarization** condenses text (extractive picks spans, abstractive generates), **QA** answers questions (extractive span selection like SQuAD, or generative).",
    intuition:
      "Same neural skeleton — encoder-decoder — powers all three; what changes is the training data and the head. Classic quality metrics: BLEU for MT (n-gram precision + brevity penalty), ROUGE for summarization (recall of reference n-grams), EM/F1 for extractive QA.",
    steps: [
      "Encode source text into embeddings (or token ids for seq2seq).",
      "Decode greedily/beam fashion; for extractive summarization pick sentences by scoring.",
      "For extractive QA: predict start/end spans with a BERT-style head + [SEP] question passage pairs.",
      "Evaluate with the matching metric family (BLEU / ROUGE / EM-F1) and human checks for factuality.",
    ],
    example:
      "Summarizing a 10-paragraph lecture: extractive picks 2 sentences with highest TF-IDF vs references; abstractive (BART/T5) produces a fresh sentence — better readability, risk of hallucinated claims.",
    useWhen: "Content workflows, support bots, multilingual publishing, studying",
    pros: ["Deployed at industrial scale (Translate, meeting summaries)", "One architecture, many tasks", "Extractive QA is factual and cheap"],
    cons: ["BLEU/ROUGE correlate poorly with human quality", "Abstractive models hallucinate", "Long documents exceed context: chunking required"],
    mistakes: ["Ranking models purely by BLEU across different tokenizers", "Extractive QA on questions whose answer is not explicit in the passage"],
    examNotes: [
      "BLEU: n-gram precision with brevity penalty; sacreBLEU standardizes",
      "ROUGE-1/2/L definitions; ROUGE = recall-oriented",
      "Extractive QA metrics: exact match and token F1",
    ],
    practice: "A summarizer copies the headline verbatim. Which metric inflates and why is that misleading?",
  },
  {
    id: "rnn-lstm",
    title: "RNNs, LSTMs and sequence-to-sequence models",
    short: "Recurrent networks that carry state, with gates to survive long inputs",
    keywords: "\\brnn\\b|recurrent|lstm|\\bgru\\b|seq2seq|sequence to sequence|vanishing gradient|teacher forcing",
    definition:
      "A **vanilla RNN** updates a hidden state hₜ = tanh(W·[hₜ₋₁, xₜ]) at every token; **LSTMs/GRUs** add gates (forget, input, output) so memory persists; **seq2seq** pairs an encoder (reads source) with a decoder (generates target).",
    intuition:
      "Plain RNNs multiply the same weight matrix hundreds of times — gradients vanish or explode. The LSTM's cell state update is ADDITIVE (cₜ = fₜ⊙cₜ₋₁ + iₜ⊙c̃ₜ), giving gradients a highway. Seq2seq then compresses translation into encode→decode, but squeezes meaning into one vector — the bottleneck attention later fixed.",
    steps: [
      "Embed tokens, feed the sequence step-by-step (batching uses padded tensors).",
      "Teacher forcing during training: feed the true previous token to the decoder.",
      "Inference: decode greedily/with beam search from the encoder state.",
      "Clip gradients (exploding) and rely on gates for long-range (vanishing).",
      "Know the bottleneck: replace mean-pooled encoding with attention for long sequences.",
    ],
    example:
      "English→French: encoder reads 'I love books' to a thought vector; decoder emits 'J a d o r e' ... until <eos>. Long source sentences degrade the vector — attention keeps a memory of all encoder states instead.",
    useWhen: "Streaming/low-latency small models; sequence labeling with modest data; historical systems",
    code: {
      install: "pip install torch",
      code: `import torch, torch.nn as nn

emb_dim, hid = 32, 64
class Encoder(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb_dim)
        self.lstm = nn.LSTM(emb_dim, hid, batch_first=True)
    def forward(self, x):
        _, (h, c) = self.lstm(self.emb(x))
        return (h, c)   # encoder state seeds the decoder

enc = Encoder(vocab_size=500)
x = torch.randint(0, 500, (2, 7))   # batch 2, len 7
h, c = enc(x)
print(h.shape)  # (num_layers=1, batch=2, hidden=64)`,
      output: "torch.Size([1, 2, 64])",
      note: "Read shapes as (layers, batch, hidden); decoder LSTM continues from (h, c).",
    },
    pros: ["Natural for streaming/variable length", "Small parameter count", "Teacher forcing simplifies training"],
    cons: ["Sequential: cannot parallelize across time", "Long-context weaker than attention", "Exploding/vanishing gradients need care (the reason gates exist)"],
    mistakes: ["Forgetting to pack/unpack padded sequences", "Bidirectional encoder inside a decoder (future leakage!)"],
    examNotes: [
      "Write the LSTM gate equations; explain each gate in one line",
      "Vanishing vs exploding: gates/additive state vs gradient clipping",
      "Seq2seq bottleneck problem + attention as the fix",
    ],
    practice: "Why is teacher forcing a problem at inference time? Name one mitigation.",
  },
  {
    id: "attention",
    title: "Attention and the Transformer architecture",
    short: "Self-attention replaces recurrence: every token looks at every token in parallel",
    keywords: "transformer|attention|self-?attention|multi-?head|query key value|\\bqkv\\b|positional encod|masked attention|\\brope\\b",
    definition:
      "**Scaled dot-product attention** computes Attention(Q,K,V) = softmax(QKᵀ/√dₖ)·V — each token queries all tokens (keys) and averages their values. Transformers stack this + FFN + residuals + LayerNorm, no recurrence needed.",
    intuition:
      "RNNs pass meaning like a relay baton (loss along the way). Attention builds a direct flight from token 1 to token 500 — parallel across positions and mathematically O(T²). Multi-head runs h attention subspaces in parallel so heads specialize (syntax here, coreference there). Positional encodings restore word ORDER that set-like attention loses.",
    steps: [
      "Project embeddings into Q,K,V per head.",
      "Scores = QKᵀ/√dₖ; the √dₖ keeps logits' variance stable so softmax doesn't saturate.",
      "Mask: decoder causal mask blocks future positions; encoder mask hides padding.",
      "Softmax over keys → weights (sum to 1 per row) → weighted V mix.",
      "Concatenate heads, project, add residual + LayerNorm; repeat with FFN blocks.",
    ],
    example:
      "In 'The cat that chased the mouse was tired', the query for 'was' attends hard to 'cat' (subject agreement) — softmax weights quantify that relationship learnably.",
    useWhen: "The architecture behind BERT/GPT/every modern LLM",
    code: {
      install: "pip install torch",
      code: `import torch, torch.nn.functional as F

def attention(q, k, v, causal=False):
    # q,k,v: (batch, heads, T, d_head)
    logits = q @ k.transpose(-2, -1) / (q.shape[-1] ** 0.5)
    mask = torch.triu(torch.ones(logits.shape[-2:], dtype=torch.bool), 1)
    if causal:
        logits = logits.masked_fill(mask, float("-inf"))
    weights = logits.softmax(dim=-1)
    return weights @ v, weights

B, H, T, d = 2, 4, 6, 16
q, k, v = torch.randn(3, B, H, T, d)
out, w = attention(q, k, v, causal=True)
print(out.shape, w.sum(dim=-1).max().item())  # rows sum to 1`,
      output: "torch.Size([2, 4, 6, 16]) 1.0",
      note: "Production blocks add nn.Linear projections for Q/K/V per head + out projection.",
    },
    pros: ["Massive parallelism → scales to billions of tokens", "Direct long-range modelling", "Multi-head covers multiple relations simultaneously"],
    cons: ["O(T²) compute and attention memory in sequence length", "Inference needs KV caches", "Position must be injected explicitly"],
    mistakes: ["Forgetting the causal mask (decoder sees the future)", "Skipping LayerNorm/residuals and wondering why training diverges"],
    examNotes: [
      "Write the attention formula and explain the √dₖ factor",
      "Why positional encodings exist; sinusoidal vs learned vs RoPE",
      "Encoder (BERT) vs decoder (GPT) masking difference",
    ],
    practice: "For T=512, d_k=64: what is the shape of QKᵀ and the compute scaling as T doubles?",
  },
  {
    id: "bert-gpt",
    title: "BERT, GPT-style models and transfer learning",
    short: "Bidirectional encoders for understanding vs causal decoders for generation",
    keywords: "\\bbert\\b|\\bgpt\\b|masked language model|causal lm|transfer learning|fine-?tun|pretrain|\\bcls\\b|\\bmlm\\b",
    definition:
      "**BERT** is a Transformer encoder pre-trained with Masked Language Modeling (bidirectional); its [CLS] representation feeds classification heads. **GPT-style** models are causal decoders trained to predict the next token; scale + instruction tuning made them general assistants.",
    intuition:
      "Two pre-training philosophies: BERT sees the whole sentence and fills blanks (great for tagging/extractive QA); GPT predicts forward only (great for generation and, at scale, in-context learning). Transfer learning means the expensive part happens ONCE on public data; your task spends 200 labelled rows + one afternoon fine-tuning (or just prompts).",
    steps: [
      "Choose encoder (understanding) vs decoder (generation) by task.",
      "Pre-train on corpora (not your job): MLM or causal LM.",
      "Adapt: fine-tune with AutoModelForSequenceClassification/TokenClassification or just prompt.",
      "For extractive QA, pair question and passage with [SEP] and predict start/end spans.",
      "Low-resource tasks: LoRA/adapter fine-tuning or few-shot prompting instead of full fine-tune.",
    ],
    example:
      "Sentiment with 800 labels: fine-tuning distilbert-base-uncased reaches ~91% SST-2-level accuracy on natural review text in minutes (API pattern from transformers); BERT from scratch would need much more.",
    useWhen: "Classification/NER/QA (BERT heads); chat, drafting, instruction following (GPT-family)",
    code: {
      install: "pip install transformers torch",
      code: `from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("distilbert-base-uncased-finetuned-sst-2-english")
mdl = AutoModelForSequenceClassification.from_pretrained(
    "distilbert-base-uncased-finetuned-sst-2-english")

inputs = tok("The lecture covered attention beautifully.", return_tensors="pt")
with torch.no_grad():
    logits = mdl(**inputs).logits
probs = logits.softmax(-1)
print(tok.convert_id_to_token([tok.cls_token_id]))
print(probs.tolist())   # [P(NEGATIVE), P(POSITIVE)]`,
      output: `['[CLS]']
[[0.001, 0.999]]   # strongly positive (approximate)`,
      note: "Fine adapter-style fine-tuning adds a small classification head; only the head + a few layers retrain.",
    },
    pros: ["Massive transfer learning gains from small labelled sets", "Encoder/decoder each fits its task family", "Both families remain the industry's go-to for tagging/understanding"],
    cons: ["Full fine-tuning needs GPUs", "Model biases inherit from corpora", "RoBERTa/various checkpoints confuse label mappings if you mix them"],
    mistakes: ["Using BERT generatively (it's an encoder!)", "Fine-tuning when a good prompt would have sufficed"],
    examNotes: [
      "MLM vs causal LM: bidirectional context vs next-token prediction",
      "[CLS] token role for classification; [SEP] for sentence pairs",
      "Transfer learning two-step: pre-train (expensive, once) → adapt (cheap, task)",
    ],
    practice: "You have 300 labelled support tickets. BERT-head or GPT zero-shot — which do you pick and why?",
  },
  {
    id: "llm-rag",
    title: "LLMs, prompt engineering and RAG",
    short: "Modern large models steered by prompts and grounded with retrieval",
    keywords: "\\bllm\\b|large language model|prompt engineering|\\brag\\b|retrieval augmented|hallucinat|context window|few-?shot|zero-?shot|in-context",
    definition:
      "**LLMs** are large causal transformers trained on broad text; **prompting** steers them without weight updates (roles, instructions, few-shot examples); **RAG** retrieves relevant documents into the prompt to ground answers and reduce hallucination.",
    intuition:
      "Recording vs artist analogy: a fine-tune bakes knowledge into weights (costly, stale), a prompt is a live instruction sheet (cheap, editable), RAG hands the model an open textbook at question time — fresh, source-cited, cheap to update.",
    steps: [
      "Set the system role (persona + rules), keep user task instructions explicit and ordered.",
      "Constrain output format (JSON schema, examples); validate and retry on parse errors.",
      "Chunk documents (~300-800 tokens with overlap) and embed into a vector index.",
      "Retrieve top-k passages per query; assemble the prompt with citations.",
      "Evaluate factuality separately from fluency (BERTScore, LLM-as-judge, human samples).",
    ],
    example:
      "Course chatbot: notes → chunks → embeddings (384-dim) → cosine top-5 → prompt 'Answer ONLY from these passages, cite pages'. Unanswerable in the corpus → the model should say so, not guess.",
    useWhen: "Assistants, grounded Q&A over private notes, code help, drafting with constraints",
    code: {
      install: "pip install transformers sentence-transformers",
      code: `from sentence_transformers import SentenceTransformer, util
model = SentenceTransformer("all-MiniLM-L6-v2")

docs = [
    "TF-IDF weights terms by frequency and rarity.",
    "LSTM gates control memory through time.",
]
query = "which technique down-weights very common terms"
emb = model.encode([query] + docs, normalize_embeddings=True)
scores = emb[0] @ emb[1:].T
for doc, s in zip(docs, scores):
    print(f"{s:.2f}  {doc[:50]}")`,
      output: `0.62  TF-IDF weights terms by frequency and rari...
0.11  LSTM gates control memory through time.
(similar idea; exact numbers model-dependent)`,
      note: "This IS the retrieval half of RAG; the generation half is any LLM called with these chunks in the prompt.",
    },
    pros: ["Fresh data without retraining", "Answers can cite sources", "Prompting tunes behaviour in hours, not weeks"],
    cons: ["Hallucination persists even with retrieval (verify!)", "Long contexts cost latency/money and mid-context recall degrades", "Prompt injection and data-leak risks need guards"],
    mistakes: ["Stuffing the whole PDF into one prompt", "Trusting model-cited page numbers without checking the source"],
    examNotes: [
      "RAG pipeline: chunk → embed → index → retrieve → prompt → generate",
      "Few-shot vs zero-shot definitions and when to choose each",
      "Why grounding reduces (but never eliminates) fabrication",
    ],
    practice: "Design a 3-shot prompt that outputs JSON {score, reason} for sentiment. Which 3 examples do you include and why?",
  },
  {
    id: "evaluation",
    title: "NLP evaluation metrics",
    short: "Precision, recall, F1, BLEU, ROUGE and perplexity — with the right one per task",
    keywords: "evaluat|\\bf1\\b|precision|recall|\\bbleu\\b|\\brouge\\b|perplexity|accuracy|confusion matrix|metric",
    definition:
      "**Precision** = TP/(TP+FP), **Recall** = TP/(TP+FN), **F1** = harmonic mean; **BLEU** n-gram precision with brevity penalty (MT); **ROUGE** recall-based overlap (summaries); **perplexity** = 2^(per-token cross-entropy) for language models.",
    intuition:
      "Accuracy lies when classes are imbalanced ('not spam' = 95% on a spam corpus!). Confusion-matrix stats expose what a model actually does: precision protects users from false alarms, recall ensures coverage. Generation metrics compare n-gram overlap with references; similarity-based (BERTScore) and LLM-as-judge extend beyond lexical overlap.",
    steps: [
      "Fix the metric to the task: classification → F1 per class; MT → BLEU; summaries → ROUGE; language modelling → perplexity.",
      "Understand the tradeoff: raising the decision threshold boosts precision, lowers recall.",
      "Multiclass: macro (each class equal) vs micro (instance-weight) vs weighted averaging.",
      "Compare only identical tokenization/versions (sacreBLEU for BLEU).",
      "Add human/semantic checks for factuality and coherence.",
    ],
    example:
      "TP=40, FP=10, FN=20 → P=0.80, R=0.67, F1=2·(0.8·0.67)/(1.47)≈0.73. Perplexity: if the LM's entropy is 3 bits/token, PPL=2³=8 (it feels ~8-way uncertainty).",
    useWhen: "Every model comparison, paper table and deployment dashboard",
    code: {
      install: "pip install scikit-learn evaluate",
      code: `from sklearn.metrics import precision_recall_fscore_support, accuracy_score

y_true = ["neg","pos","neg","neg","pos","pos"]
y_pred = ["neg","pos","pos","neg","neg","pos"]
print("accuracy", accuracy_score(y_true, y_pred))
p, r, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", pos_label="pos")
print(f"P={p:.2f} R={r:.2f} F1={f1:.2f}")`,
      output: `accuracy 0.67
P=0.67 R=0.67 F1=0.67`,
      note: "average='binary' treats pos as positive; macro/weighted for multiclass tasks.",
    },
    pros: ["Standardized comparison across papers/systems", "Reveals per-class weaknesses accuracy hides", "BLEU/ROUGE need no human annotators after references exist"],
    cons: ["Piece-vs-n-gram mismatch between implementations skews scores", "Generation metrics punish valid phrasing variations", "Perplexity measures fluency, not truthfulness"],
    mistakes: ["Comparing BLEU across different tokenizations", "Reporting only accuracy on imbalanced data", "Reading perplexity as 'quality of answers'"],
    examNotes: [
      "Derive F1 from P and R; know macro vs micro vs weighted",
      "Perplexity: lower better; 2^entropy relationship",
      "BLEU = precision-oriented (MT), ROUGE = recall-oriented (summaries)",
    ],
    practice: "P=0.9, R=0.3 — write F1 and explain which behaviour the model has (allergic to false positives or missing most cases?).",
  },
  {
    id: "responsible",
    title: "Deployment, bias, privacy and responsible AI",
    short: "Shipping NLP responsibly: fairness, privacy, monitoring",
    keywords: "bias|fairness|privacy|responsible ai|deployment|monitoring|drift|GDPR|ethic|prompt injection|toxicity",
    definition:
      "Responsible NLP deployment combines **bias auditing** (per-group performance), **privacy** (data minimisation, retention limits), **robustness/monitoring** (drift, adversarial inputs like prompt injection) and transparency about limits.",
    intuition:
      "Models learn data distributions — including who is underrepresented in them. A summarizer trained mostly on US news mis-serves other regions quietly. Deployment adds real users, real data flows, real legal constraints (GDPR) and real abuse vectors (prompt injection, PII leakage into logs).",
    steps: [
      "Slice evaluation by demographic/domain groups; report per-group metrics, not just aggregate.",
      "Minimise data: only collect what the feature needs; set retention windows.",
      "Add input/output guardrails: PII redaction, moderation, rate limiting.",
      "Monitor drift and abuse in production (embedding-drift plots, sampling reviews).",
      "Document model limits in-app (the NL-honesty pattern): show confidence, sources, fallback to humans.",
    ],
    example:
      "NER for resumes mis-tags non-English names with far worse F1 → hiring pipeline bias. Fix: diversify annotation sources, balance evaluation across groups, human review on low-confidence spans.",
    useWhen: "Any production NLP; the checklist stage before launch",
    pros: ["Prevents legal/reputational damage", "Better user trust and retention", "Monitoring surfaces silent quality decay"],
    cons: ["Extra build/eval effort", "Perfect fairness metrics don't exist; trade-offs need decisions", "Privacy compliance interacts with training data provenance"],
    mistakes: ["Logging raw prompts with PII forever", "Auditing bias only once before launch"],
    examNotes: [
      "Define demographic/representation bias with one realistic NLP example",
      "Data minimisation principle; why retention limits matter",
      "Prompt injection: attacker text overrides instructions — mitigate with role separation/validation",
    ],
    practice: "Your summarizer logs every user text to disk. List four risks and one mitigation each.",
  },
];

export const CARD_BY_ID = new Map(TOPIC_CARDS.map((c) => [c.id, c]));
