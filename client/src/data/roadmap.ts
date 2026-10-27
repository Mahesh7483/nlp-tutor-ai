export interface RoadmapItem {
  id: string;
  label: string;
  note?: string;
}

export interface RoadmapStage {
  id: string;
  phase: number;
  title: string;
  outcome: string;
  prereq: string;
  items: RoadmapItem[];
}

export const ROADMAP: RoadmapStage[] = [
  {
    id: "stage-1",
    phase: 1,
    title: "Python & text foundations",
    outcome: "You can load, inspect and clean any raw text corpus in Python.",
    prereq: "None — start from zero.",
    items: [
      { id: "r1-1", label: "Python basics: strings, lists, dictionaries, comprehensions" },
      { id: "r1-2", label: "Unicode: encodings, NFC/NFKC normalization, BOM" },
      { id: "r1-3", label: "Reading files, encoding errors, encoding='utf-8' pitfalls" },
      { id: "r1-4", label: "Regular expressions: character classes, groups, findall, sub" },
      { id: "r1-5", label: "Mini-project: clean a raw .txt corpus (typos, whitespace, URLs)" },
    ],
  },
  {
    id: "stage-2",
    phase: 2,
    title: "Classical NLP pipeline",
    outcome: "You can run a textbook NLP pipeline and explain every stage on an exam.",
    prereq: "Stage 1",
    items: [
      { id: "r2-1", label: "Tokenization: sentence, word, and why models differ", },
      { id: "r2-2", label: "Stop words, stemming (Porter/Snowball), lemmatization (WordNet, spaCy)" },
      { id: "r2-3", label: "POS tagging: HMM idea + modern taggers" },
      { id: "r2-4", label: "NER: BIO scheme, spaCy entity matcher" },
      { id: "r2-5", label: "Chunking, constituency and dependency parsing basics" },
      { id: "r2-6", label: "Mini-project: full pipeline over news headlines with spaCy" },
    ],
  },
  {
    id: "stage-3",
    phase: 3,
    title: "Text as numbers (IR & statistics)",
    outcome: "You can build classic retrieval and ML baselines from scratch.",
    prereq: "Stage 2, basic probability",
    items: [
      { id: "r3-1", label: "One-hot encoding and Bag of Words" },
      { id: "r3-2", label: "TF-IDF math incl. smoothing; cosine similarity" },
      { id: "r3-3", label: "N-gram language models: MLE, Laplace/Kneser-Ney smoothing, perplexity" },
      { id: "r3-4", label: "Classification: Naive Bayes / Logistic Regression / SVM on features" },
      { id: "r3-5", label: "Evaluation: precision, recall, F1, confusion matrix" },
      { id: "r3-6", label: "Mini-project: spam or sentiment classifier on TF-IDF features" },
    ],
  },
  {
    id: "stage-4",
    phase: 4,
    title: "Dense representations",
    outcome: "You can work with Word2Vec/GloVe embeddings and explain their training.",
    prereq: "Stage 3",
    items: [
      { id: "r4-1", label: "Distributional hypothesis and dense vectors" },
      { id: "r4-2", label: "Word2Vec: Skip-gram vs CBOW, negative sampling" },
      { id: "r4-3", label: "GloVe and fastText differences" },
      { id: "r4-4", label: "Similarity, analogy tasks, vector arithmetic" },
      { id: "r4-5", label: "Bias in embeddings: sources and mitigation" },
      { id: "r4-6", label: "Mini-project: semantic search over concepts with Word2Vec" },
    ],
  },
  {
    id: "stage-5",
    phase: 5,
    title: "Neural sequence models",
    outcome: "You understand why recurrent architectures were invented and their limits.",
    prereq: "Stage 4, basic calculus & linear algebra",
    items: [
      { id: "r5-1", label: "Vanilla RNN and backpropagation through time" },
      { id: "r5-2", label: "Vanishing/exploding gradients, gradient clipping" },
      { id: "r5-3", label: "LSTM and GRU gates, checkpoint-style intuition" },
      { id: "r5-4", label: "Encoder-decoder (seq2seq) and the information bottleneck" },
      { id: "r5-5", label: "Mini-project: character-level text generation RNN in PyTorch" },
    ],
  },
  {
    id: "stage-6",
    phase: 6,
    title: "Attention & Transformers",
    outcome: "You can derive the attention formula and describe the full architecture.",
    prereq: "Stage 5",
    items: [
      { id: "r6-1", label: "Scaled dot-product attention: Q, K, V and the √d_k factor" },
      { id: "r6-2", label: "Masks: causal vs padding" },
      { id: "r6-3", label: "Multi-head attention, residual connections, LayerNorm" },
      { id: "r6-4", label: "Positional encodings (sinusoidal, learned, RoPE)" },
      { id: "r6-5", label: "BERT vs GPT-2/3+ pre-training objectives" },
      { id: "r6-6", label: "Mini-project: implement one attention head in PyTorch" },
    ],
  },
  {
    id: "stage-7",
    phase: 7,
    title: "Modern LLMs & transfer learning",
    outcome: "You can adapt or prompt modern models for real tasks responsibly.",
    prereq: "Stage 6",
    items: [
      { id: "r7-1", label: "Fine-tuning choices: full vs LoRA/adapter alternatives" },
      { id: "r7-2", label: "Prompt engineering: roles, few-shot, structured output" },
      { id: "r7-3", label: "RAG: chunking, embeddings, vector search, grounding" },
      { id: "r7-4", label: "Evaluation beyond BLEU: BERTScore, LLM-as-judge, factuality" },
      { id: "r7-5", label: "Mini-project: build a grounded Q&A assistant over your own notes" },
    ],
  },
  {
    id: "stage-8",
    phase: 8,
    title: "Applications & responsible deployment",
    outcome: "You can take an NLP app from notebook to a considerate, monitored service.",
    prereq: "Stage 7 (at least partially)",
    items: [
      { id: "r8-1", label: "Classic application inventory: MT, summarization, QA, browsers" },
      { id: "r8-2", label: "Serving: batch vs streaming, latency, model caching" },
      { id: "r8-3", label: "Bias, fairness, privacy; prompt-leak and injection concerns" },
      { id: "r8-4", label: "Logging, monitoring, drift detection" },
      { id: "r8-5", label: "Mini-project: deploy your classifier behind an HTTP API with limits" },
    ],
  },
];

export const totalRoadmapItems = ROADMAP.reduce((sum, s) => sum + s.items.length, 0);
