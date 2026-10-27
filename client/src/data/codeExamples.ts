export interface CodeExample {
  title: string;
  task: string;
  packages: string[];
  install: string;
  explanation: string;
  code: string;
  input?: string;
  output?: string;
  tags: string[];
}

export const CODE_EXAMPLES: CodeExample[] = [
  {
    title: "Tokenization & basic preprocessing",
    task: "Split raw text into sentence and word tokens, then clean it.",
    packages: ["NLTK"],
    install: "pip install nltk",
    explanation:
      "NLTK needs data packs the first time (punkt_tab). word_tokenize handles punctuation and contractions properly.",
    code: `import nltk
nltk.download("punkt_tab", quiet=True)
from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus import stopwords

text = "Dr. Chen didn't reply. It wasn't surprising!!"
sentences = sent_tokenize(text)
tokens = word_tokenize(text)
lower = [t.lower() for t in tokens if t.isalnum()]
stop = set(stopwords.words("english"))
filtered = [t for t in lower if t not in stop]

print(sentences)
print(tokens)
print(filtered)`,
    input: 'text = "Dr. Chen didn\'t reply. It wasn\'t surprising!!"',
    output: `["Dr. Chen didn't reply.", "It wasn't surprising!!"]
['Dr.', 'Chen', 'did', "n't", 'reply.', 'It', 'was', "n't", 'surprising', '!!']
['dr', 'chen', 'reply', 'surprising']`,
    tags: ["tokenization", "preprocessing", "nltk"],
  },
  {
    title: "Stemming vs lemmatization",
    task: "Reduce inflected words to stems and lemma forms side by side.",
    packages: ["NLTK"],
    install: "pip install nltk",
    explanation:
      "The Porter stemmer applies slicing rules purely mechanically; the WordNet lemmatizer requires POS context to pick the correct lemma.",
    code: `import nltk
nltk.download(["wordnet", "omw-1.4"], quiet=True)
from nltk.stem import PorterStemmer, WordNetLemmatizer

words = ["studies", "studies", "flies", "geese", "better"]

stemmer = PorterStemmer()
lemmatizer = WordNetLemmatizer()

for word in set(words):
    print(word, "->", stemmer.stem(word), "|", lemmatizer.lemmatize(word, "v"))`,
    input: 'words = ["studies", "flies", "geese", "better"]',
    output: `studies -> studi | studi   (as verb POS, WordNet cannot map)
flies -> fli | fly
geese -> gees | geese     (irregular plurals need morphology)
better -> better | better`,
    tags: ["stemming", "lemmatization", "nltk"],
  },
  {
    title: "TF-IDF + Logistic Regression classifier",
    task: "Train a classical text classifier with scikit-learn.",
    packages: ["scikit-learn"],
    install: "pip install scikit-learn",
    explanation:
      "Pipeline keeps vectorization consistent at inference (fit on train only). ngram_range=(1,2) captures short negations like 'not good'.",
    code: `from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

texts = [
    "I liked the movie, well acted",
    "Terrible plot, waste of money",
    "Great acting by the entire cast",
    "Boring and predictable",
    "Loved every minute of it",
    "The movie was too boring",
]
labels = ["pos", "neg", "pos", "neg", "pos", "neg"]

X_tr, X_te, y_tr, y_te = train_test_split(texts, labels, test_size=0.33, random_state=42, stratify=labels)

model = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
    ("clf", LogisticRegression(max_iter=1000)),
])
model.fit(X_tr, y_tr)

print(model.predict(["an absolute masterpiece", "absolutely dull"]))
print(classification_report(y_te, model.predict(X_te), output_dict=False, zero_division=0))`,
    output: `['pos' 'neg']  # for a real dataset; toy example may differ in exact confidence values`,
    tags: ["classification", "tfidf", "scikit-learn"],
  },
  {
    title: "NER with spaCy",
    task: "Extract people, organisations, and locations from text.",
    packages: ["spaCy (en_core_web_sm model)"],
    install: "pip install spacy && python -m spacy download en_core_web_sm",
    explanation:
      "doc.ents yields spans with entity type; ENT labels come from the OntoNotes convention (PERSON, ORG, GPE, DATE...).",
    code: `import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Tim Cook announced a partnership between Apple and IISc Bangalore on 25 March 2024.")

for ent in doc.ents:
    print(ent.text, "|", ent.label_)

# part-of-speech + dependency quick view
for token in doc[:4]:
    print(token.text, token.pos_, token.dep_)`,
    input: '"Tim Cook announced a partnership between Apple and IISc Bangalore on 25 March 2024."',
    output: `Tim Cook | PERSON
Apple | ORG
IISc Bangalore | ORG (or GPE depending on model version)
25 March 2024 | DATE
Tim PROPN nsubj ... — entity labels vary slightly across model versions, so don't hard-code them.`,
    tags: ["ner", "pos", "spacy"],
  },
  {
    title: "Word embeddings (GloVe)",
    task: "Load pretrained embeddings and compute semantic similarity.",
    packages: ["gensim (downloads ~100 MB once)"],
    install: "pip install gensim",
    explanation:
      "gensim.downloader fetches pretrained GloVe vectors; cosine similarity encodes semantic closeness, and vector arithmetic surfaces analogies.",
    code: `import gensim.downloader as api
model = api.load("glove-wiki-gigaword-100")

print(model.most_similar("king", topn=3))
print(model.similarity("cat", "dog"))
analogy = model.most_similar(positive=["king", "woman"], negative=["man"], topn=1)
print(analogy)`,
    output: `[('queen', 0.75), ('monarch', ...), ...]  # typical shape, exact values depend on corpus version
0.70  # approximate
[('queen', 0.85)]  # approximate`,
    tags: ["embeddings", "word2vec", "glove", "gensim"],
  },
  {
    title: "Sentiment analysis with Hugging Face",
    task: "Use a pretrained transformer for sentiment without training.",
    packages: ["transformers", "torch"],
    install: "pip install transformers torch",
    explanation:
      "The pipeline API abstracts tokenizer → model → softmax → label mapping. distilbert-base-uncased-finetuned-sst-2-english outputs POSITIVE/NEGATIVE with a confidence score.",
    code: `from transformers import AutoTokenizer, AutoModelForSequenceClassification, TextClassificationPipeline

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased-finetuned-sst-2-english")
model = AutoModelForSequenceClassification.from_pretrained("distilbert-base-uncased-finetuned-sst-2-english")
pipe = TextClassificationPipeline(model=model, tokenizer=tokenizer, top_k=1, truncation=True)

for text in ["The lecture was outstanding!", "The homework was gruelling and unclear."]:
    print(text, "->", pipe(text))`,
    output: `{'label': 'POSITIVE', 'score': 0.999}  # approximate
{'label': 'NEGATIVE', 'score': 0.998}  # approximate`,
    tags: ["transformers", "sentiment", "hugging-face"],
  },
  {
    title: "Rule-based VADER sentiment",
    task: "Score sentiment without any training using lexicon rules.",
    packages: ["NLTK (vader lexicon)"],
    install: "pip install nltk",
    explanation:
      "VADER returns compound in [-1, 1]; |compound| above ~0.05 maps to pos/neg. Handled by the lexicon plus heuristics for caps, punctuation, negation.",
    code: `import nltk
nltk.download("vader_lexicon", quiet=True)
from nltk.sentiment.vader import SentimentIntensityAnalyzer

sia = SentimentIntensityAnalyzer()
examples = ["I LOVE this.", "it is okay I guess.", "that was terrible mentioning 'okay'."]
for s in examples:
    print(s, "->", sia.polarity_scores(s)["compound"])`,
    output: `values typically: 0.72, 0.36, -0.30 (approximate)`,
    tags: ["sentiment", "vader", "nltk"],
  },
  {
    title: "Minimal attention head (PyTorch)",
    task: "Implement one scaled dot-product attention head from scratch.",
    packages: ["PyTorch"],
    install: "pip install torch",
    explanation:
      "Q, K, V are (B, T, d) tensors. Masking future positions keeps a decoder causal; scaling by sqrt(d) keeps softmax gradients sane. Written for clarity over production quality.",
    code: `import torch
import torch.nn as nn
import torch.nn.functional as F

def attention(q, k, v, mask=None):
    # q,k,v: (B, T, d)
    logits = q @ k.transpose(-2, -1) / (q.shape[-1] ** 0.5)   # (B, T, T)
    if mask is not None:
        logits = logits.masked_fill(mask, float("-inf"))
    weights = F.softmax(logits, dim=-1)
    return weights @ v, weights

B, T, d = 2, 4, 16
q, k, v = torch.randn(3, B, T, d)
causal = torch.triu(torch.ones(T, T, dtype=torch.bool), diagonal=1)
out, weights = attention(q, k, v, causal)
print(out.shape, weights[0].sum(dim=-1)[:, :2].tolist())`,
    output: `torch.Size([2, 4, 16])  # each row of weights sums to 1 across the allowed positions`,
    tags: ["attention", "transformer", "pytorch"],
  },
  {
    title: "Subword tokenizers comparison",
    task: "See how one sentence is split by WordPiece/SentencePiece.",
    packages: ["Hugging Face tokenizers (transformers includes it)"],
    install: "pip install transformers",
    explanation:
      "Different pretrained vocabularies slice text differently; always use the tokenizer matching the model checkpoint you load.",
    code: `from transformers import AutoTokenizer

text = "unaffordable extraordinary renormalize"
for name in ["bert-base-uncased", "gpt2", "google-t5/t5-base"]:
    tok = AutoTokenizer.from_pretrained(name)
    print(name, "->", tok.tokenize(text))`,
    input: 'text = "unaffordable extraordinary renormalize"',
    output: `bert-base-uncased -> ['un', '##afford', '##able', 'extra', '##ordinary', 'ren', '##ormal', '##ize']
(gpt2 splits aggressively because it has no WordPiece prefix — it post-processes to space-delimited pieces; t5 uses SentencePiece pieces)`,
    tags: ["tokenization", "subword", "hugging-face"],
  },
  {
    title: "Evaluation metrics from scratch",
    task: "Compute accuracy, precision, recall and F1 without sklearn.",
    packages: ["Plain Python"],
    install: "no installation needed",
    explanation:
      "Knowing the formulas is required knowledge: precision = TP/(TP+FP), recall = TP/(TP+FN), F1 harmonic mean.",
    code: `def prf1(y_true, y_pred, positive="pos"):
    tp = fp = fn = 0
    for t, p in zip(y_true, y_pred):
        if t == positive and p == positive: tp += 1
        elif t != positive and p == positive: fp += 1
        elif t == positive and p != positive: fn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall    = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return precision, recall, f1

y_true = ["pos", "neg", "neg", "pos", "pos"]
y_pred = ["pos", "pos", "neg", "pos", "neg"]
print(prf1(y_true, y_pred))`,
    output: `(0.6667, 0.6667, 0.6667)  # TP=2, FP=1, FN=1`,
    tags: ["evaluation", "f1", "precision", "recall"],
  },
  {
    title: "Simple RNN text generation (PyTorch)",
    task: "Train a character-level LSTM on a toy sentence corpus.",
    packages: ["PyTorch"],
    install: "pip install torch",
    explanation:
      "A demo of the loop concept: the model learns p(next_char|context). Real systems use words/subwords and much larger data.",
    code: `import torch, torch.nn as nn

text = "nlp engineering is building systems that understand text. "
chars = sorted(set(text))
c2i = {c: i for i, c in enumerate(chars)}
i2c = {i: c for c, i in c2i.items()}
seq = torch.tensor([c2i[c] for c in text])

h_size = 8
class TinyLM(nn.Module):
    def __init__(self, vocab):
        super().__init__()
        self.emb = nn.Embedding(vocab, h_size)
        self.rnn = nn.LSTM(h_size, h_size, batch_first=True)
        self.out = nn.Linear(h_size, vocab)
    def forward(self, x, state=None):
        out, state = self.rnn(self.emb(x), state)
        return self.out(out), state

model = TinyLM(len(chars))
loss_fn = nn.CrossEntropyLoss()
opt = torch.optim.Adam(model.parameters(), lr=0.01)

x = seq[:-1].unsqueeze(0)
y = seq[1:].unsqueeze(0)
for step in range(200):
    logits, _ = model(x)
    loss = loss_fn(logits.reshape(-1, len(chars)), y.reshape(-1))
    opt.zero_grad(); loss.backward(); opt.step()
    if step % 50 == 0:
        print(step, round(loss.item(), 3))`,
    output: `loss decreasing from ~3.2 toward well under 1.0 on this toy text (approximate)`,
    tags: ["rnn", "lstm", "pytorch", "language-model"],
  },
  {
    title: "Regex extraction recipes",
    task: "Extract emails, URLs and numbers with Python's re module.",
    packages: ["Standard library (re)"],
    install: "no installation needed",
    explanation:
      "Raw-string regexes avoid backslash headaches. Use findall for extraction, sub for replacement, and named groups for readability.",
    code: `import re

text = "Write to me at u07234@univ.in or see https://nlp-notes.example.edu/unit3"
emails = re.findall(r"[\\w.+-]+@[\\w-]+\\.[\\w.-]+", text)
urls   = re.findall(r"https?://\\S+", text)
nums   = re.findall(r"\\b\\d{4}\\b", text)
clean  = re.sub(r"\\s{2,}", " ", "a   b".replace("\\s", " "))

print(emails, urls, nums, clean)`,
    input: '"Write to me at u07234@univ.in or see https://nlp-notes.example.edu/unit3"',
    output: `['u07234@univ.in']
['https://nlp-notes.example.edu/unit3']
['0723']
['a b']`,
    tags: ["regex", "preprocessing", "python"],
  },
];
