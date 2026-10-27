import type { QuizQuestion } from "../types.js";

/**
 * Offline practice bank used by quiz generation as a fallback (demo mode,
 * or when live AI generation fails) so Quiz Practice always works.
 */

type Raw = [
  topic: string,
  difficulty: QuizQuestion["difficulty"],
  question: string,
  options: [string, string, string, string],
  answerIndex: number,
  explanation: string,
];

const RAW: Raw[] = [
  // ---- Tokenization / preprocessing ----
  ["Tokenization", "beginner", "What is the primary purpose of tokenization in NLP?", ["To translate text into another language", "To split text into smaller units (tokens) that models can process", "To remove stop words from text", "To generate embeddings for words"], 1, "Tokenization converts raw text into discrete units (characters, words, or subwords) that form the vocabulary a model operates over."],
  ["Tokenization", "intermediate", "What is the main motivation for subword tokenization such as BPE?", ["It removes spelling errors", "It keeps vocabulary size bounded while still representing rare/unknown words", "It is faster than word tokenization", "It improves grammar in outputs"], 1, "Subwords decompose rare words into reusable pieces, avoiding the <UNK> problem and vocabulary explosion of word-level vocabularies."],
  ["Tokenization", "advanced", "In WordPiece (BERT), what does the '##' prefix on a token indicate?", ["A special masked token", "The token continues a word (not word-initial)", "The token is unknown", "A separator between sentences"], 1, "'##' marks continuation subwords, e.g. 'unaffordable' → ['un', '##afford', '##able']."],
  ["Text preprocessing", "beginner", "Why is lowercasing often applied during preprocessing — and when is it harmful?", ["Always harmless; apply everywhere", "It unifies inflections; harmful for tasks needing case, like NER", "It removes stop words; harmful for search", "It expands contractions properly"], 1, "Case folding merges 'The/the', but destroys case features; NER and models with case-sensitive vocabularies perform worse."],
  ["Text preprocessing", "intermediate", "Which normalisation step handles characters like 'é' vs 'e' consistently?", ["Stemming", "Unicode normalisation (e.g. NFC/NFKC)", "Padding", "Truncation"], 1, "Unicode normalisation (NFC/NFKC) composes or decomposes accented characters so identical visual text matches byte-for-byte."],
  ["Regular expressions", "intermediate", "Which regex reliably extracts a typical email-looking pattern from text?", ["/mailto:/", "/\\d{10}/", "/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/", "/https?:\\/\\/\\S+/"], 2, "The character-class pattern matches local part, @ symbol, domain and TLD; \\d{10} matches phone digits, https matches URLs only."],

  // ---- Stemming / lemmatization / stopwords ----
  ["Stemming & lemmatization", "beginner", "Stemming versus lemmatization: which statement is true?", ["Stemming always produces dictionary words", "Lemmatization uses morphology and context to return a valid base form", "They are identical procedures", "Lemmatization is faster than stemming"], 1, "Stemming strips affixes by rules ('studies→studi'); lemmatization maps to a real lemma ('studies→study') using POS and a lexicon."],
  ["Stemming & lemmatization", "intermediate", "NLTK's WordNetLemmatizer on 'flies' with default POS returns 'fly', but on the verb it returns 'fly' only when POS='v'. What does this show?", ["The lemmatizer is buggy", "Lemmatization depends on part-of-speech context", "WordNet only knows nouns", "Stemming is required first"], 1, "Without POS context, lemmatizers resolve ambiguous inflections incorrectly — demonstrating why lemmatization needs morphological/contextual information."],
  ["Stop words", "beginner", "Removing stop words primarily aims to…", ["Shorten code", "Drop very frequent low-meaning words to reduce noise and size", "Tokenize sentences", "Normalise unicode"], 1, "Stop-word removal prunes high-frequency function words ('the', 'is') that add little discriminative value for many tasks."],

  // ---- N-grams / language models ----
  ["N-gram language models", "beginner", "A bigram model computes P(w2|w1) as…", ["count(w2)/count(w1)", "count(w1,w2)/count(w1)", "count(w1,w2)/N", "count(w1)/count(w2)"], 1, "The Markov bigram estimate is joint count of the bigram over the count of the conditioning word."],
  ["N-gram language models", "intermediate", "What is the purpose of Laplace (add-one) smoothing?", ["Speed up training", "Redistribute probability mass so unseen n-grams get non-zero probability", "Generate embeddings", "Reduce vocabulary"], 1, "Additive smoothing replaces maximum-likelihood zeros with a small floor, keeping probability distributions valid for unseen events."],
  ["N-gram language models", "advanced", "A trigram LM has perplexity 45. What does that most nearly mean?", ["45 % accuracy", "Equivalent uncertainty to uniformly choosing among ~45 continuations", "45 tokens of context", "Bleu score of 45"], 1, "Perplexity is the exponentiated per-token cross-entropy — effective branching factor of the model's predictions."],

  // ---- POS/NER ----
  ["Part-of-speech tagging", "beginner", "In dependency-grammar style annotation, what does a POS tag describe?", ["The syntactic category of a word (noun, verb…)", "Named entities", "Sentiment polarity", "The document language"], 0, "POS tagging assigns lexical categories (NOUN, VERB, ADJ…) used downstream for lemmatization, chunking and parsing."],
  ["Part-of-speech tagging", "intermediate", "Which is a sequence model classically applied to POS tagging?", ["K-means", "Hidden Markov Model with the Viterbi algorithm", "PCA", "TF-IDF SVM"], 1, "HMMs model tag sequences with transition/emission probabilities resolved by Viterbi decoding; CRFs and neural taggers generalise this idea."],
  ["Named Entity Recognition", "beginner", "In BIO tagging for NER, what does the 'B' label mean?", ["Beginning of a document", "First token of an entity chunk", "Best entity", "Beginner entity"], 1, "BIO uses B (begin), I (inside), O (outside) to mark entity spans such as 'New York' = B-LOC I-LOC."],
  ["Named Entity Recognition", "intermediate", "Typical named entity types recognised by spaCy's models include…", ["PERSON, ORG, GPE, DATE", "VARIABLE, FUNCTION, CLASS", "POS, DEP, LEMMA", "TOKEN, SENT, PARA"], 0, "Common entity labels: PERSON, ORGANIZATION, GPE (geo-political entities), DATE, MONEY, etc."],

  // ---- Parsing / semantics ----
  ["Parsing", "intermediate", "Which statement contrasts the two parsing formalisms correctly?", ["Dependency analysis yields constituency trees", "Constituency represents phrasal hierarchies; dependency represents head-modifier relations", "Both always agree", "Dependency syntax ignores word order entirely"], 1, "Constituency parsing builds nested phrase structures (NP, VP); dependency analysis links words to their grammatical heads."],

  // ---- Representations ----
  ["TF-IDF & BoW", "beginner", "TF-IDF specifically helps by…", ["Removing only rare words", "Down-weighting frequent generic terms while up-weighting distinctive ones", "Generating vector semantics", "Skipping tokenization"], 1, "tf-idf = local frequency × corpus-level rarity, de-emphasising ubiquitous terms like 'the'."],
  ["TF-IDF & BoW", "intermediate", "In scikit-learn, why is idf smoothed with +1 in the denominator?", ["To keep weights non-negative / avoid divide-by-zero", "To make weights sparse", "To fit softmax", "For hashing"], 0, "Without smoothing, extremely common terms can flip idf negative and numeric stability suffers; smoothing keeps weights meaningful."],
  ["Word embeddings", "beginner", "The main advantage of dense word embeddings over one-hot vectors is…", ["They are larger", "They place similar words close together and generalise", "They remove rare words", "They encode syntax trees"], 1, "Distributed representations capture similarity structure that one-hot encodings (all words equidistant) cannot."],
  ["Word embeddings", "intermediate", "Word2Vec's Skip-gram model trains to…", ["Predict the middle word from neighbors", "Predict surrounding context words from a center word", "Translate text", "Cluster sentences"], 1, "Skip-gram = center-to-context prediction; CBOW is the reverse mapping."],
  ["Word embeddings", "advanced", "'King − man + woman ≈ queen' illustrates…", ["Regression on counts", "Linear arithmetic of meaning in embedding (GloVe/Word2Vec) space", "Attention recombination", "Stop-word removal"], 1, "ANalogy tasks exploit approximately linear directions for gender/royalty relations in static embeddings."],
  ["GloVe", "intermediate", "How does GloVe differ from Word2Vec?", ["It factorises global co-occurrence counts rather than predicting on windows", "It is strictly worse", "It is a parser", "It ignores word order and statistics"], 0, "GloVe trains on ratios from the document-wide co-occurrence matrix; Word2Vec uses local sliding windows."],

  // ---- Classification ----
  ["Text classification", "intermediate", "On an imbalanced sentiment dataset, which metric is more informative than raw accuracy?", ["Word count", "F1-score (and a confusion matrix)", "Character length", "Perplexity"], 1, "Accuracy hides majority-class dominance; F1/precision/recall per class expose what is actually being learned."],
  ["Sentiment analysis", "beginner", "VADER is best described as…", ["A lexicon+rule sentiment scorer", "A seq2seq translator", "A pretrained BERT model", "A tokenizer"], 0, "VADER scores with a curated lexicon plus rules for capitals, punctuation, boosters — no training needed."],
  ["Sentiment analysis", "advanced", "Why can a bag-of-words sentiment model fail on \"No, great job…\"?", ["Extra whitespace", "Single-word sentiment aggregation cannot resolve negation scope", "Lowercasing errors", "Missing embeddings"], 1, "Positive words outweighed context; n-grams or contextual models partly resolve negation scope."],

  // ---- Sequence models ----
  ["Sequence models", "beginner", "The vanishing gradient problem in vanilla RNNs is largely due to…", ["Too much data", "Repeated multiplication of the recurrent weight matrix across time steps", "Very long words", "Input padding"], 1, "Backpropagation through time multiplies Jacobians each step; norms < 1 shrink gradients exponentially."],
  ["Sequence models", "intermediate", "Which LSTM gate controls how much of the cell state is discarded?", ["Input gate", "Forget gate", "Output gate", "Peephole"], 1, "The forget gate scales previous cell memory before the additive update; input/output gates handle new data and exposure."],
  ["Sequence models", "advanced", "The 'bottleneck' limitation of plain seq2seq encoder-decoder models is that…", ["Decoders cannot emit tokens", "The whole source meaning must compress into a single fixed-vector context", "Embeddings are too big", "Loss explodes"], 1, "Attention was introduced precisely to decode source tokens as queues instead of one global state."],

  // ---- Transformers ----
  ["Attention & Transformers", "beginner", "Scaled dot-product attention divides QK^T by sqrt(d_k) to…", ["Save memory", "Keep logits at stable scale before softmax", "Increase sparsity", "Skip normalisation"], 1, "Scaling controls logit variance as head dimension grows, avoiding softmax saturation and vanishing gradients."],
  ["Attention & Transformers", "beginner", "Positional encodings are needed because self-attention is…", ["Very slow", "Permutation-invariant without explicit position signals", "Causal", "Recursive"], 1, "Attention treats input as a set; position vectors (sinusoidal/learned/RoPE) inject order information."],
  ["Attention & Transformers", "intermediate", "BERT pre-training uses the objective…", ["Causal next-token prediction", "Masked language modelling", "Reinforcement learning from human feedback", "Translation only"], 1, "BERT reconstructs masked tokens using bidirectional context; GPT uses next-token prediction."],
  ["Attention & Transformers", "advanced", "Multi-head attention benefits learning primarily by…", ["Reducing parameters", "Running independent attention subspaces that specialise to different relations", "Enforcing causality", "Removing FFN layers"], 1, "Each head projects into its own Q/K/V space, letting the model attend to different positions/aspects simultaneously."],

  // ---- LLM era ----
  ["LLMs & RAG", "intermediate", "Retrieval-Augmented Generation primarily reduces…", ["Model size", "Hallucination and staleness by conditioning on retrieved sources", "Prompt length", "Tokenisation cost"], 1, "RAG grounds answers in retrieved documents, making factual claims cheaper to verify and freshness minutes-old."],
  ["LLMs & RAG", "advanced", "In a typical RAG pipeline, what replaces BM25 keyword recall when embeddings are added?", ["Chunk truncation", "Dense vector similarity search (e.g. cosine)", "Stop-word removal", "Masked decoding"], 1, "Embedding similarity retrieval (dense passage retrieval) complements/extends sparse lexical methods like BM25."],
  ["Prompt engineering", "beginner", "Temperature in decoding controls…", ["Response length", "Sampling randomness of token distribution", "Learning rate", "The number of attention layers"], 1, "Temperature rescales logits before softmax: near 0 ≈ argmax (deterministic), higher ≈ more diverse sampling."],
  ["Prompt engineering", "intermediate", "An effective way to reduce format errors (JSON/schema violations) is…", ["Raising temperature", "Provide an explicit schema, examples and validation/retry logic", "Lowering max_tokens below output length", "Removing the system prompt"], 1, "Constrained prompting plus user-side validation (retry with the error message) reliably improves structured outputs."],

  // ---- Evaluation ----
  ["NLP evaluation", "beginner", "Precision@k in information retrieval measures…", ["Relevant documents among the top k returned", "Total documents indexed", "Latency milliseconds", "Recall of a corpus"], 0, "Precision@k = (relevant docs in top-k) / k."],
  ["NLP evaluation", "intermediate", "BLEU was designed primarily for…, while ROUGE is common for…", ["Summarisation; translation", "Translation; summarisation", "Parsing; tagging", "Tagging; parsing"], 1, "BLEU's n-gram + brevity-penalty design targets MT adequacy; ROUGE's recall orientation suits summaries."],
  ["NLP evaluation", "advanced", "Perplexity improvements do not guarantee better downstream task performance because…", ["PPL uses BLEU", "Fluency and likelihood correlate imperfectly with usefulness; tasks add retrieval, reasoning, style", "High perplexity is desirable", "Tokenisers differ"], 1, "A model can assign high probability to generic, unhelpful text; usefulness needs task-specific evaluation."],

  // ---- Applications / responsible AI ----
  ["Responsible AI", "intermediate", "A common source of demographic bias in NER systems is…", ["Using markdown", "Annotated corpora under-representing names/communities", "Interpolating embeddings", "Batch size"], 1, "Models learn distribution the data contains; skewed supervision leads to skewed recognition quality across groups."],
  ["Applications", "beginner", "Which pairing of task → metric is conventional?", ["Summarisation → perplexity", "Question answering → exact match / F1", "Tagging → BLEU", "Parsing → VADER"], 1, "Extractive QA is evaluated by EM and token-level F1 against annotator answers."],
  ["Applications", "intermediate", "Deploying an NLP API responsibly includes…", ["Logging raw user text forever", "Data minimisation, rate limits, bias evaluation, and clear disclaimers", "Removing all error messages", "Ignoring privacy laws"], 1, "Minimisation, monitoring and fairness/robustness checks are baseline deployment hygiene."],
];

export const QUIZ_BANK: QuizQuestion[] = RAW.map((q, index) => ({
  id: `bank-${index + 1}`,
  topic: q[0],
  difficulty: q[1],
  question: q[2],
  options: [...q[3]],
  answerIndex: q[4],
  explanation: q[5],
}));

export function sampleFromBank(
  topics: string[],
  difficulty: string | null,
  count: number,
): QuizQuestion[] {
  const wantedTopics = new Set(topics.map((t) => t.toLowerCase()));
  let pool = QUIZ_BANK.filter((q) => {
    const topicOk = wantedTopics.size === 0 ? true : topics.some((t) => q.topic.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(q.topic.toLowerCase()));
    const diffOk = !difficulty || difficulty === "mixed" ? true : q.difficulty === difficulty;
    return topicOk && diffOk;
  });
  if (pool.length === 0) pool = QUIZ_BANK;
  // deterministic-ish shuffle with fresh order per request
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
