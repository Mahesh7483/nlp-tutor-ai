import type { ChatRequestBody } from "../types.js";
import { NLP_TOPICS } from "./tutorPrompt.js";

/**
 * Offline demo engine. The backend runs in demo mode when no AI credentials
 * are configured. It streams canned-but-real NLP lessons so the app is fully
 * usable, and it is always honest that these are samples, not live answers.
 */

export const DEMO_BANNER =
  "**Demo mode** — no AI provider is configured, so this is a built-in sample lesson rather than a live answer. Add `AI_API_KEY`, `AI_BASE_URL` and `AI_MODEL` to `server/.env` to enable the real tutor. *(Settings page has the exact steps.)*\n\n";

interface Lesson {
  keywords: RegExp;
  match?: "any" | "all" | "compare";
  title: string;
  body: string;
}

const LESSONS: Lesson[] = [
  {
    title: "Tokenization",
    keywords: /\btokeniz(er|ation|ing)?\b/i,
    body: `## Definition
**Tokenization** is the process of splitting raw text into smaller units — *tokens* — that a model can process (usually words, subwords, or characters).

## Why it exists
Computers can't do statistics on raw strings. Tokens are the vocabulary unit: everything downstream (vocabulary building, embeddings, probabilities) is defined over tokens.

## Levels of tokenization
| Level | Example: \`"Unaffordable!"\` |
|---|---|
| Sentence | one sentence |
| Word | \`Unaffordable\`, \`!\` |
| Character | \`U, n, a, f, f, o, r, d, a, b, l, e, !\` |
| Subword | \`un\`, \`##afford\`, \`##able\`, \`!\` |

## Step by step (word-level)
1. Normalize text (lowercase, expand punctuation).
2. Split on a boundary rule (whitespace/regex).
3. Join contract tokens, e.g. \`don't → do + n't\`.
4. Build the vocabulary; map tokens → integer ids (\`word → index\`).

## Python example (NLTK + Hugging Face)
\`\`\`python
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
nltk.download("punkt_tab")  # tokenizer data (models data)

text = "Dr. Chen didn't like slow queries. Vector search is fast!"
print(sent_tokenize(text))
print(word_tokenize(text))

# Subword tokenization with a modern tokenizer
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained("bert-base-uncased")
print(tok.tokenize("unaffordable"))
print(tok.convert_tokens_to_ids(tok.tokenize("unaffordable")))
\`\`\`

**Expected output (approximate):**
\`\`\`text
["Dr. Chen didn't like slow queries.", "Vector search is fast!"]
['Dr.', 'Chen', 'did', "n't", 'like', 'slow', 'queries.', 'Vector', 'search', 'is', 'fast', '!']
['un', '##afford', '##able']
\`\`\`
(Roughly — ids differ because they depend on the actual vocabulary in \`bert-base-uncased\`.)

## Why subwords won
Rare words explode a word-level vocabulary (unfamiliar tokens → \`<UNK>\`). Subword schemes like **BPE** / **WordPiece** decompose rare words into reusable pieces, keeping the vocabulary bounded (~30k) while representing unseen words.

## Advantages vs limitations
- ✅ Word tokens are interpretable; character tokens never emit \`<UNK>\`; subwords balance both.
- ❌ Naive splits break contractions/URLs; word-level vocabularies grow poorly; languages without spaces need different rules.

## Common mistakes
- Forgetting \`nltk.download(...)\` data before tokenizing.
- Lowercasing before NER (it destroys capitalization features).
- Assuming every model uses the same tokenizer — token ids are vocab-specific.

## Exam notes
- Sentence vs word vs subword levels + one example of each.
- BPE = iteratively merge most frequent pair; WordPiece differentiates \`##\` prefixes; UNK problem.
- Why tokenization must match the pretrained model exactly.

**Practice question:** Tokenize \`"UNESCO% is renormalizing data??"\` three ways (sentence, NLTK word, BERT subword). What changes and why?`,
  },
  {
    title: "TF-IDF step by step",
    keywords: /\btf[- ]?idf\b/i,
    body: `## Definition
**TF-IDF (Term Frequency–Inverse Document Frequency)** weights a term by how frequent it is in a document but how rare it is across the whole corpus.

## Intuition
Words appearing in *every* document ("the", "is") carry little meaning for retrieval/classification. TF-IDF downweights them automatically.

## Step by step
For term $t$ in document $d$, in corpus $N$ documents:
1. **TF**: $\\text{tf}(t,d) = \\dfrac{f_{t,d}}{\\sum_{t'} f_{t',d}}$ (term count / total terms in the doc, or raw count).
2. **IDF**: $\\text{idf}(t) = \\log_2 \\dfrac{N}{1 + df_t}$ (rare term → large value; the \`+1\` avoids division by zero).
3. **TF-IDF**: $w = \\text{tf} \\times \\text{idf}$ — then normalize the document vector if needed.

## Worked example
Corpus: 1,000 documents. Term "tokenization" appears 5 times in doc d (d has 50 tokens).
- tf = 5/50 = 0.1
- df("tokenization") = 8 → idf = log₂(1000/(1+8)) = log₂(111.1) ≈ 6.79
- **tf-idf ≈ 0.1 × 6.79 = 0.68** (high weight: specific and frequent here)

For "the": df ≈ 1000 → idf = log₂(1000/1001) < 0 → scikit-learn smooths this with \`+1\` inside the log so the weight stays ≥ 0.

## Python example (scikit-learn)
\`\`\`python
from sklearn.feature_extraction.text import TfidfVectorizer

corpus = [
    "The transformer uses attention instead of recursion.",
    "Attention allows the transformer to focus on tokens.",
    "Vector retrieval matches tf-idf weighted documents.",
]
vec = TfidfVectorizer(ngram_range=(1, 2))
X = vec.fit_transform(corpus)          # sparse matrix
print(vec.get_feature_names_out()[:8])
print(X.shape)
# rank each corpus document by tf-idf score of the query "attention"
q = vec.transform(["attention"])                       # same vocab as corpus
scores = (X @ q.T).toarray().ravel()                   # one score per doc
print(list(zip(range(len(corpus)), scores)))
for i, score in enumerate(scores):
    print(f"doc {i}: {corpus[i]} -> {score:.3f}")
\`\`\`

**Expected output (approximate):**
\`\`\`text
['allows' 'allows the' 'attention' 'attention instead' ...]
(3, 28)
\`\`\`
Document similarity scores: doc 0 and doc 1 score highest because **both contain "attention"**; doc 2 scores low.

## Uses
- Keyword extraction / search ranking (classic IR baseline).
- Linear SVM / logistic-regression text classifiers — surprisingly strong baselines.
- Weakness: it's *bag-of-words*: no word order, no semantics ("good" vs "not good" unrelated; synonyms get different vectors).

## Advantages / limitations / common mistakes
- ✅ Simple, fast, interpretable, works without GPUs.
- ❌ Ignores word order & meaning; needs corpus smoothing; sparse vectors don't compress well.
- ⚠️ Mistakes: fitting the vectorizer on train **and** test data (data leakage) — fit on train, transform test; forgetting to vectorize with the training vocabulary at inference.

## Exam notes
- Justify the \`+1\`/smooth idf; compute tf-idf for a tiny two-document corpus by hand — this is a classic exam numerical!
- TF-IDF vs one-hot vs BoW: one-hot ignores frequency entirely; BoW counts raw frequency; TF-IDF frequency × rarity.

**Practice question:** Given tf=3/30 and idf=log₂(10), what is the weight? Then explain in one line why idf can't be negative under scikit-learn's smoothing.`,
  },
  {
    title: "Stemming vs lemmatization",
    keywords: /\bstemming\b/i,
    match: "compare",
    body: `## Quick definition
| | **Stemming** | **Lemmatization** |
|---|---|---|
| What | chop affixes by rule | map to dictionary base form |
| Uses | suffix rules only | morphology + POS context |
| Example | studies → studi | studies → study |
| Speed | fast | slower (needs lexicon/tagger) |
| Common tools | Portstammer, Snowball (NLTK) | WordNet Lematizer (NLTK), spaCy |

## Intuition
Stemming is a crude mechanical rule ("cut -ing, -ed, -s"), so you get *machine, studi, cager* style artifacts — fast but often not real words. Lemmatization asks "what's the actual head word?" using a dictionary and the word's grammatical role — usually the right answer for analysis.

## Step-by-step process
**Stemming (Porter)**: ① match suffix rules by step (sses→ss, ies→i, 's→removed, ed, ly...); ② apply within the "measure" constraints of its syllable heuristic.
**Lemmatization** ① determine POS context; ② look the (word, POS) up in a morphological lexicon (WordNet); ③ return the lemma or the original word if unknown.

## Python example
\`\`\`python
import nltk
nltk.download("wordnet"); nltk.download("omw-1.4")
from nltk.stem import PorterStemmer, WordNetLemmatizer

words = ["studies", "studying", "better", "flies", "easily"]
stemmer = PorterStemmer()
lemmatizer = WordNetLemmatizer()
print("Porter   :", [stemmer.stem(w) for w in words])
print("WordNet-n:", [lemmatizer.lemmatize(w) for w in words])           # default POS = noun
print("WordNet-v:", [lemmatizer.lemmatize(w, "v") for w in words])
import spacy
nlp = spacy.load("en_core_web_sm")
print([t.lemma_ for t in nlp("The flies are studying better quickly.")])
\`\`\`

**Expected output (approximate):**
\`\`\`text
Porter   : ['studi', 'studi', 'better', 'fli', 'easili']
WordNet-n: ['study', 'studying', 'better', 'fly', 'easily']
WordNet-v: ['studi', 'study', 'better', 'fly', 'easily']
SpaCy    : ['the', 'fly', 'be', 'study', 'well', 'quickly']
\`\`\`
Note the differences: \`flies\` → \`fli\` (stem, not a word), \`fly\` after lemmatizing as a verb/noun; \`better\` needs \`"well"\` via spaCy (WordNet without POS can't do this rewrite).

## When to use which
- Search / IR index → stemming (speed helps, aggressive reduction boosts recall).
- Linguistic analysis, chatbots, annotation → lemmatization (correct forms matter).
- Modern deep models → often **neither** — subword tokens handle inflection implicitly.

## Common mistakes
- Lemmatizing without POS context → ambiguous words stay wrong.
- Applying a stemmer to a tokenization already stored with case-preserved text.
- Expecting stemming to always produce dictionary words — it usually doesn't (that's by design).

## Exam notes
- Define both, give one concrete contrast (studies→studi vs studies→study).
- Know the term **over stemming / under stemming**.
- Lemmatization needs morphological analysis; mention WordNet explicitly if you name the tool.

**Practice question:** Apply Porter stemming and WordNet lemmatization (verb) to \`"running, stories, was, geese"\` and explain each mismatch.`,
  },
  {
    title: "Transformer architecture & attention",
    keywords: /transform(er|ers)|attention|self[- ]attention|qkv/i,
    body: `## Definition
The **Transformer** (Vaswani et al., 2017 — "Attention Is All You Need") is an encoder-decoder architecture built entirely from **self-attention** and feed-forward layers — no recurrence.

## Why it matters
- Parallel across positions (unlike RNNs) → trainable at scale.
- Short, learnable connections between any two tokens → fixes long-range dependency pain in LSTMs.

## Building blocks: scaled dot-product attention
$$\\text{Attention}(Q,K,V) = \\text{softmax}\\left(\\dfrac{QK^\\top}{\\sqrt{d_k}}\\right)V$$
- $Q$ = what a token is looking for, $K$ = what each token offers, $V$ = what it would pass along.
- $\\sqrt{d_k}$ keeps logits at a stable variance so softmax isn't saturated.
- **Multi-head attention** runs $h$ attention heads in parallel, concatenates, projects — heads specialize (syntax, coreference, local vs long range...).

## Full architecture (original)
\`\`\`text
Input embedding + positional encoding
        ↓
[ Encoder ×N:  multi-head self-attention → add&norm → feed-forward → add&norm ]
        ↓ (encoder outputs = K,V)
[ Decoder ×N:  masked self-attention → add&norm
               cross-attention(Q=decoder, K,V=encoder) → add&norm
               feed-forward → add&norm ]
        ↓
linear + softmax → token probabilities
\`\`\`
- Masked (causal) attention in the decoder prevents attending to future tokens.
- Residual connections + LayerNorm stabilize training; FFN adds per-position capacity.

## Attention in three steps
1. Project to $Q,K,V$, keep positional/casual masks valid.
2. Scores $= QK^\\top/\\sqrt{d_k}$ → masked → **softmax** → attention weights (each row sums to 1).
3. Weighted sum of $V$ rows.

## Python (PyTorch — hand-rolled self-attention)
\`\`\`python
import torch, torch.nn as nn, torch.nn.functional as F

class SelfAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0
        self.d_head = d_model // n_heads
        self.n_heads = n_heads
        self.qkv = nn.Linear(d_model, 3 * d_model, bias=False)
        self.proj = nn.Linear(d_model, d_model)

    def forward(self, x, causal: bool = True):
        B, T, D = x.shape
        q, k, v = self.qkv(x).chunk(3, dim=-1)
        # (B, h, T, dk)
        shape = lambda z: z.view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        q, k, v = shape(q), shape(k), shape(v)
        logits = (q @ k.transpose(-2, -1)) / self.d_head ** 0.5
        if causal:
            mask = torch.triu(torch.ones(T, T, dtype=torch.bool), 1)
            logits = logits.masked_fill(mask, float("-inf"))
        att = logits.softmax(dim=-1)
        out = (att @ v).transpose(1, 2).contiguous().view(B, T, D)
        return self.proj(out)   # HINT: residual + norm go in the tutorial block
\`\`\`
*(Self-contained, runnable PyTorch; shapes are (batch, time, model-dim).)*

## Positional encodings, briefly
Self-attention is permutation-invariant, so position must be injected: sinusoids of varying frequency, or **learned** positional embeddings; modern LLMs often use **RoPE** (rotary embeddings).

## Advantages / limitations
- ✅ Massive parallelism, long-range modeling, scales (the pretraining recipe of BERT/GPT).
- ❌ Attention cost is $O(T^2)$ in sequence length; context limits; compute-hungry inference (KV cache trades memory for speed).

## Common mistakes
- Forgetting the mask (decoder "cheats" by seeing the future).
- Ignoring layer norm / residual structure and wondering why training diverges.
- Believing attention filters stop words automatically — it learns patterns, soft weights are just softmax scores.

## Exam notes
- Write the attention formula and explain $\\sqrt{d_k}$.
- Why positional encodings exist; what multi-head attention buys.
- Encoder (BERT-style, bidirectional) vs decoder (GPT-style, causal) vs seq2seq (original).

**Practice question:** For seq length $T$ and head dim $d_k$, what is the attention compute cost? What does masking a decoder row enforce?`,
  },
  {
    title: "Exam preparation",
    keywords: /\bexam|revision|important questions|viva|midterm|finals?\b/i,
    body: `Below is a well-rounded revision sheet. *(Demo mode reminder: these are hand-written, not generated live.)*

## Concept questions that come up repeatedly
1. Define tokenization; contrast word vs subword with one example.
2. Stemming vs lemmatization — definition, one example (\`studies → studi\` vs \`studies → study\`), one use case each.
3. Explain TF-IDF with formulas; compute it for a small two-document corpus.
4. Why do we need word embeddings? What's the difference between one-hot + BoW + TF-IDF?
5. Describe Word2Vec (CBOW vs SkipGram training task, negative sampling).
6. Write the scaled dot-product attention formula; explain the $\\sqrt{d_k}$ factor.
7. Contrast BERT (masked LM, bidirectional) with GPT (causal LM, unidirectional).
8. What is perplexity? A lower perplexity X means what exactly?
9. Define BLEU/ROUGE; name two limitations of n-gram overlap metrics.
10. Markov assumption in N-gram models and how smoothing (Laplace / Good-Turing) fixes zero counts.

## Short numericals worth practicing
- Logistic regression text classifier: given precision 0.8, recall 0.6 → F1 = 2·(0.8·0.6)/(0.8+0.6) = **0.686**.
- Bigram probability: P(word2|word1) = count(w1,w2)/count(w1), with add-k smoothing when count=0.
- Position of a token after BERT WordPiece if a word splits into 3 sub-words.

## Ten-line answers expected
- RNN/LSTM gates (forget, input, output) and why LSTM beats plain RNN on long texts.
- Sequence-to-sequence model + the bottleneck problem.
- NER: why BIO tagging, and what the "B"/"I"/"O" losses mean.
- Ambiguity & discourse (anaphora, ellipsis) — why parsing isn't enough.

## Quick-fire check list (tick mentally)
- [x] I can implement tokenization + stemming in NLTK.
- [x] I can train a TF-IDF + LogisticRegression pipeline in scikit-learn.
- [x] I can explain Word2Vec training and use pre-trained GloVe.
- [x] I can write the attention equation and multi-head math.
- [x] I can compute perplexity from a unigram/bigram model.
- [ ] Revise **hand-written** notes for my exact syllabus — *(I can't claim to know your syllabus; upload your notes in the Documents panel and I'll answer from them.)*`,
  },
  {
    title: "Sentiment analysis code",
    keywords: /\bsentiment\b/i,
    body: `## Definition
**Sentiment analysis** classifies text into sentiment classes (positive/negative/neutral, or a scalar score).

## Three common engineering approaches
1. Lexicon (VADER) — fast, no training; good for short informal text.
2. Classical ML — TF-IDF + Logistic Regression / SVM; strong baseline, cheap, interpretable.
3. Deep — fine-tune a pretrained transformer (BERT/DistilBERT); best accuracy, needs GPU/serving care.

## Python example A — lexicon with VADER (offline, quick)
\`\`\`python
# pip install nltk
import nltk
nltk.download("vader_lexicon")
from nltk.sentiment.vader import SentimentIntensityAnalyzer

sia = SentimentIntensityAnalyzer()
for sentence in ["I love this keyboard!", "It works, but battery life is terrible."]:
    print(sentence, "->", sia.polarity_scores(sentence))
\`\`\`
**Expected output (typical):**
\`\`\`text
I love this keyboard! -> {'neg': 0.0, 'neu': 0.357, 'pos': 0.643, 'compound': 0.669}
It works, but battery life is terrible. -> {'neg': 0.43, 'neu': 0.57, 'pos': 0.0, 'compound': -0.765}
\`\`\`
(Exact scores depend on the installed lexicon version.)

## Python example B — TF-IDF + Logistic Regression (scikit-learn)
\`\`\`python
# pip install scikit-learn pandas
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

texts  = ["great phone battery is amazing", "worst purchase ever", "ok but camera is bad",
          "love the screen", "poor sound quality", "decent value for money"]
labels =  ["pos", "neg", "neg", "pos", "neg", "pos"]           # toy labelled set

X_tr, X_te, y_tr, y_te = train_test_split(texts, labels, test_size=0.34, random_state=0, stratify=labels)
clf = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
    ("lr",    LogisticRegression(max_iter=1000)),
]).fit(X_tr, y_tr)

print(clf.predict(["battery drains fast", "screen is gorgeous"]))
print(classification_report(y_te, clf.predict(X_te), zero_division=0))
\`\`\`
**Expected output (typical on this toy set):** predictions like \`['neg', 'pos']\`; precision/recall printed per class — with 6 training examples this is a demo, not a real system.

## Python example C — pretrained transformer (Hugging Face)
\`\`\`python
# pip install transformers torch
from transformers import pipeline
clf = pipeline("sentiment-analysis", model="distilbert/distilbert-base-uncased-finetuned-sst-2-english")
for s in ["I adore this library!", "The update broke my workflow."]:
    print(s, "->", clf(s)[0])
\`\`\`
**Expected output (typical):** \`POSITIVE with conf ~0.999\` for the first; \`NEGATIVE\` for the second. (No guarantee of exact confidence values.)

## Advantages / limitations / common mistakes
- VADER: ✅ zero shot, fast, handles punctuation/caps; ❌ English-tuned, misses sarcasm.
- TF-IDF+LR: ✅ fast/robust baseline; ❌ bag-of-words — no negation handling beyond n-grams.
- Transformers: ✅ contextual nuance; ❌ divergence risk between domains, compute cost, shorter output than lexicons.

## Common mistakes
- Binary class when data has neutral examples — metrics tank on the majority class.
- Training/eval on shuffled text from **the same review author** — leakage inflates scores.
- Reporting accuracy alone on imbalanced data — add F1 and a confusion matrix.

## Exam notes
- VADER compound ∈ [-1, +1]; thresholds commonly ±0.05.
- TF-IDF + linear model is still the right first baseline; transformers after.

**Practice question:** Why do naive word-level sentiment matchers misfire on *"no, great job..."*? How do n-gram vs transformer models fix this?`,
  },
  {
    title: "Embeddings & Word2Vec",
    keywords: /\bembedding(s)?\b|\bword2vec\b|\bglove\b/i,
    body: `## Definition
A **word embedding** is a dense, low-dimensional vector (~50–300 dims) representing a word, positioned so similar meanings sit close together (cosine similarity).

## One-hot vs embedding intuition
- One-hot: \`"cat" = [0,0,1,0,...]\` — every pair of words is equally distant. No meaning captured.
- Embedding: \`cat ≈ [0.71, 0.23, ...]\` learned from co-occurrence — \`cat\` closer to \`dog\` than to \`car\`. King − man + woman ≈ queen-style vector arithmetic is the classic demo.

## How Word2Vec learns
**Skip-gram**: given center word, predict its neighbors. **CBOW**: surround → center. A small window slides over text; a tiny linear model is trained so the "context" classifier is right. **Negative sampling** replaces a softmax over the whole vocabulary with ~5–20 random negatives — cheap and effective.
GloVe instead factorizes a global co-occurrence matrix; **fastText** learns n-grams so rare/misspelled words are still embeddable.

## Python example (gensim Word2Vec + pre-trained)
\`\`\`python
# pip install gensim
import gensim.downloader as api

# Pretrained word embeddings (downloads once, ~100 MB for glove-wiki-gigaword-100)
glove_model = api.load("glove-wiki-gigaword-100")
sim = glove_model.most_similar("king", topn=5)
analogy = glove_model.most_similar(positive=["king", "woman"], negative=["man"], topn=1)
print("top-5 similar to 'king':", sim)
print("king - man + woman ->", analogy)

cos = glove_model.similarity("cat", "dog")
print("cosine(cat, dog) =", round(cos, 3))
\`\`\`
**Expected output (typical):** similarity list headed by \`queen\`, \`prince\`; the analogy best match is usually \`queen\`; cosine(cat,dog) is clearly positive (~0.6–0.9 depending on model).
*(Exact numbers vary per model and corpus — don't memorize them as fixed values.)*

## Contextual vs static
Static embeddings give one vector per word type — the vector for \`bank\` is identical in *river bank* and *ICICI bank*. **Contextual** models (BERT etc.) produce a vector per token *instance*, so the same surface word changes representation with context.

## Advantages / limitations / common mistakes
- ✅ Dense (low-dim) vectors generalize far better than one-hot; transfer to any downstream task.
- ❌ Statics: one sense per word; \`\`<UNK>\`\` for rare words (fixed by fastText/subwords); typical gender/cultural biases are inherited from corpus statistics.
- ⚠️ Mistakes: assuming embedding similarity equals *semantic relevance* for every downstream use (and forgetting domain shift); training Word2Vec on a tiny corpus and expecting sensible neighbors.

## Exam notes
- Skip-gram vs CBOW; why negative sampling; window size effect.
- GloVe trains on global counts, Word2Vec on local windows.
- Cosine similarity formula and why it beats Euclidean distance on embeddings.

**Practice question:** Why can't you average word embeddings and claim sentence meaning? What's a better sentence embedding approach?`,
  },
  {
    title: "RNN / LSTM / seq2seq",
    keywords: /\brnn\b|\blstm\b|\bgru\b|seq2seq|sequence[- ]to[- ]sequence/i,
    body: `## Definition
A **Recurrent Neural Network** processes a sequence one token at a time, carrying a hidden state forward. An **LSTM/GRU** adds gates to *control* what persists, mitigating vanishing gradients.

## Vanilla RNN recurrence
$h_t = \\tanh(W_{hh} h_{t-1} + W_{xh} x_t + b)$ — every step multiplies by $W_{hh}$: over long sequences gradients either explode or shrink toward zero.

## LSTM gates (intuition first)
- **Forget gate** $f_t = \\sigma(W_f[h_{t-1}, x_t])$ — keep/clear old memory cell contents.
- **Input gate** $i_t$ — how much new candidate $\\tilde{c}_t$ enters the cell.
- **Cell update** $c_t = f_t \\odot c_{t-1} + i_t \\odot \\tilde{c}_t$.
- **Output gate** $o_t$ — how much of the cell is exposed as $h_t$.
The additive path $c_{t-1} → c_t$ gives gradients a highway — that's what enables long dependencies.

## Seq2seq shape (e.g. translation)
Encoder reads source tokens → returns compressed thought vector; Decoder starts from it and generates greedily or with beam search. **Bottleneck problem:** one fixed vector must hold the entire source meaning → attention then moved the field.

## Python sketch (PyTorch)
\`\`\`python
import torch, torch.nn as nn

class Encoder(nn.Module):
    def __init__(self, vocab, emb=64, hid=128):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb)
        self.lstm = nn.LSTM(emb, hid, batch_first=True)
    def forward(self, x):                    # x: (B, T) token ids
        out, (h, c) = self.lstm(self.emb(x))
        return out, (h, c)                   # out: (B, T, hid)

class Decoder(nn.Module):
    def __init__(self, vocab, emb=64, hid=128):
        super().__init__()
        self.emb = nn.Embedding(vocab, emb)
        self.lstm = nn.LSTM(emb, hid, batch_first=True)
        self.out = nn.Linear(hid, vocab)
    def step(self, y_prev, state):
        out, state = self.lstm(self.emb(y_prev.unsqueeze(1)), state)
        logits = self.out(out.squeeze(1))    # (B, vocab)
        return logits, state
\`\`\`
Typical training: feed shifted right-truncated target tokens with teacher forcing; decode with greedy/beam at inference.

## Advantages / limitations / common mistakes
- ✅ Natural for streaming/variable-length text; small parameter footprint (esp. GRU).
- ❌ Sequential → slow to parallelize; long-range memory weak compared with attention; no access to future in vanilla teacher forcing.
- ⚠️ Mistakes: forgetting \`packed\` sequences for padded batches; unbatched hidden state across batch boundaries; expecting bidirectional encoders in decoders.

## Exam notes
- Write the LSTM gate equations; explain each gate in one sentence.
- Vanishing vs exploding gradients: truncation (clip) for explode, gates/residuals for vanish.
- Compare seq2seq with attention vs pure seq2seq: attention lifts the bottleneck. No need for Transformer details here.

**Practice question:** Why is teacher forcing a problem at test time? Name one mitigation (beam search / scheduled sampling).`,
  },
  {
    title: "BERT / GPT / LLMs",
    keywords: /\bbert\b|\bgpt\b|\bllm\b|large language model|prompt engineering|\brag\b/i,
    body: `## The two paradigms
- **BERT-style (encoder)**: *Masked Language Modeling* — replace ~15% tokens with [MASK]/random and reconstruct them using **both directions**. Great at understanding tasks (classification, NER, QA extraction).
- **GPT-style (decoder)**: *Causal LM* — predict next token from a left-to-right window. Great at generation and, when scaled, at instruction following + few-shot learning.

## Transfer learning flow
1. **Pre-train** on huge unlabeled corpora (the expensive step).
2. **Adapt**: fine-tune on labeled task data (BERT) or prompt/in-context condition (GPT).
3. Optionally RAG — retrieve relevant passages into the prompt to reduce hallucination and staleness.

## Prompt engineering in practice
- Provide a **system role** (persona + rules), instructions in priority order, few-shot examples with the same format you want back, and clear output constraints (e.g. "answer with JSON matching this schema").
- Iteratively test: an instruction that's great for prose may fail for structured output.
- Beware: longer context is not infinite memory; middle of a long context is often weakest ("lost in the middle").

## RAG pipeline (simplified, real components)
\`\`\`text
Documents ─chunking→ embeddings → vector DB (index)
Question  → embed → similarity search → top-k passages → prompt assembly → LLM
\`\`\`

## Python example (Hugging Face, standard API)
\`\`\`python
# pip install transformers torch
from transformers import pipeline

pipe = pipeline("text-classification", model="dslim/bert-base-NER")  # NER head
print(pipe("Sundar Pichai visited IISc Bangalore in July 2024."))

from transformers import pipeline as pl
gen = pl("text-generation", model="Qwen/Qwen2.5-0.5B-Instruct")  # small CPU-capable LLM
out = gen("List 3 steps to clean a dataset:", max_new_tokens=60, do_sample=False)
print(out[0]["generated_text"])
\`\`\`
**Expected output (typical):** NER notices entity tags like B-PER/I-PER, B-ORG/I-ORG, B-LOC...; generation is short text following the beginning. (Exact tokens depend on model+version; nothing here was executed.)

## Advantages / limitations / common mistakes
- ✅ Models generalize; few-shot prompting avoids the labeling cost; RAG grounds factual answers.
- ❌ Hallucination, bias inherited from data, cost, privacy of prompts, latency.
- ⚠️ Mistakes: fine-tune-first when a better prompt would do; trusting a model's citation page numbers; stuffing whole 100-page PDFs into context instead of retrieving.

## Exam notes
- BERT uses [CLS] for classification, [SEP] segment pairs; MLM objective; WordPiece tokenizer.
- GPT: autoregressive, trained with softmax cross-entropy on next token.
- Why temperature ≈ 0 for reproducible classification; temperature > 0 for creative generation.

**Practice question:** Design a 3-shot prompt so the model outputs JSON {score, justification} for a sentiment task — what exactly would you include to reduce format failures?`,
  },
  {
    title: "Evaluation metrics",
    keywords: /\bbleu\b|\brouge\b|perplexity|\bf1\b|precision|recall|evaluation|metric/i,
    body: `## Definitions (memorize these)
| Metric | Measures | Classic task |
|---|---|---|
| Accuracy | fraction correct | classification (balanced) |
| Precision | TP/(TP+FP) — of predicted positives, how many right | spam filter |
| Recall | TP/(TP+FN) — of true positives, how much found | information retrieval |
| F1 | 2·P·R/(P+R) | imbalanced classification |
| BLEU | n-gram precision vs reference (+ brevity penalty) | machine translation |
| ROUGE | n-gram/token **recall** (ROUGE-1/2/L) | summarization |
| Perplexity | $2^{\\text{(cross-entropy per token)}}$ | language modeling |

## Worked micro-examples
- Confusion matrix: TP=40, FP=10, FN=20 → P=0.80, R=0.67, **F1≈0.73**.
- Perplexity: if a unigram LM gives log-likelihood 3 bits per word, perplexity = 2³ = **8** (the LM is as uncertain as choosing uniformly among ~8 words). Lower = better;
- BLEU-4 needs matched 1–4-gram precision × brevity penalty $e^{1-r/max}$. A 6-word prediction vs 12-word reference gets a heavy penalty even with perfect matches.

## Python example
\`\`\`python
from sklearn.metrics import precision_recall_fscore_support, accuracy_score
y_true = ["neg","pos","neg","neg","pos","pos"]
y_pred = ["neg","pos","pos","neg","neg","pos"]
print("accuracy", accuracy_score(y_true, y_pred))
print(precision_recall_fscore_support(y_true, y_pred, average="macro")[:3])

# pip install evaluate  (or sacrebleu/rouge-score directly)
from evaluate import load
bleu  = load("bleu").compute(predictions=["the transformer beats rnn"], references=[["the transformer beats the rnn"]])
rouge = load("rouge").compute(predictions=["the transformer beats rnn"], references=["the transformer beats the rnn"])
print(bleu["bleu"], {k: v for k, v in rouge.items() if k.startswith("rouge")})
\`\`\`
**Expected output (typical):** accuracy = 0.83; macro (P, R, F1) ≈ (0.75, 0.75, 0.75); a *small but non-zero* BLEU because unmatched tokens ("rnn" vs "the rnn") and ROUGE-1/2/L around 0.67–0.75. (Exact numbers depend on versions.)

## Advantages / limitations
- Precision/recall/F1: interpretable per class; need averaging strategy for multiclass (macro vs micro vs weighted).
- BLEU/ROUGE: cheap and automatic; ❌ poor judges of fluency/factuality, insensitive to phrasing ("beat" ≠ "surpasses"), don't capture order of content. Modern fixes: BERTScore, COMET, LLM-as-judge (report those instead when possible).

## Common mistakes
- Reporting only accuracy on imbalanced rare-class NLP.
- Comparing BLEU across different tokenization settings (sacreBLEU fixes this).
- Reading perplexity as "reads like"; it correlates with fluency, not with truthfulness.

## Exam notes
- Derive F1 from P and R; know macro vs micro averaging.
- Perplexity = exponential average inverse probability; lower is better; base matches the entropy base.
- BLEU focuses on precision (MT); ROUGE on recall (summaries).

**Practice question:** A summarizer copies the headline verbatim. Which metric inflates, and why is that misleading?`,
  },
];

function pickLesson(message: string): Lesson | null {
  const scored = LESSONS.map((lesson) => {
    const count = (message.match(lesson.keywords) || []).length;
    return { lesson, score: count };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score > 0 ? best.lesson : null;
}

/** General fallback for demo mode. */
const LESSON_INDEX = LESSONS.map((l) => `- ${l.title} — ${NLP_TOPICS[0] ? "sample lesson" : ""}`).join("");

export function buildDemoAnswer(body: ChatRequestBody): string {
  const lesson = pickLesson(body.message);
  if (lesson) {
    return `${DEMO_BANNER}# ${lesson.title}\n\n${lesson.body}`;
  }

  const topicHint = NLP_TOPICS.slice(0, 4).join(", ");
  return `${DEMO_BANNER}>You asked: **${body.message.slice(0, 140)}${body.message.length > 140 ? "…" : ""}**

The offline demo engine only carries a few complete sample lessons (tokenization, TF-IDF, stemming vs lemmatization, attention & transformers, Word2Vec/LSTMs, BERT/GPT, evaluation metrics, sentiment analysis code and an exam-prep sheet). It cannot compose new explanations.

**What NLP Tutor AI covers when live:** ${topicHint}, and 16 more topic areas — see the Learning Roadmap page for the full list.

## How to get real answers
1. Stop the backend, then create \`server/.env\` (copy \`server/.env.example\`).
2. Set the three variables:
\`\`\`bash
AI_API_KEY=sk-your-key
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
\`\`\`
- Use the base URL and model id that matches your provider — OpenAI, Azure-compatible, OpenRouter, local servers like Ollama or LM Studio all work via /v1-style chat-completions endpoints.)
3. Restart: \`npm run dev:server\`, and the header indicator should turn **Live**.

Meanwhile, try a suggested prompt like *"Explain tokenization with examples"* to see a full demo lesson.`;
}

export const demoEngineStats = {
  lessons: LESSONS.length,
  index: LESSON_INDEX,
};
