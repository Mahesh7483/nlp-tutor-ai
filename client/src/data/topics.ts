/** The default NLP Engineering learning scope (user-provided course notes always take priority). */

export interface NlpTopic {
  id: string;
  name: string;
  prompt: string; // pre-filled chat prompt
  blurb: string;
  area: "Foundations" | "Classical NLP" | "Representation" | "Deep learning" | "Modern LLM era" | "Practice & reliability";
}

export const NLP_TOPICS: NlpTopic[] = [
  { id: "intro", name: "Introduction to NLP", area: "Foundations", blurb: "What NLP is and where it is used.", prompt: "Introduce NLP engineering with real-world applications." },
  { id: "preprocessing", name: "Text preprocessing & Unicode", area: "Foundations", blurb: "Cleaning, normalization, encoding.", prompt: "Teach me text preprocessing, cleaning and Unicode handling with examples." },
  { id: "tokenization", name: "Tokenization", area: "Foundations", blurb: "Sentence, word and subword tokens.", prompt: "Explain tokenization with examples." },
  { id: "regex", name: "Regular expressions", area: "Foundations", blurb: "Pattern-based text extraction.", prompt: "Teach me regular expressions for text extraction in NLP with Python examples." },
  { id: "stemming", name: "Stemming & lemmatization", area: "Classical NLP", blurb: "Word reduction strategies.", prompt: "Compare stemming and lemmatization with examples." },
  { id: "ngrams", name: "N-gram language models", area: "Classical NLP", blurb: "Probability and smoothing.", prompt: "Teach me N-gram language models and smoothing step by step." },
  { id: "pos", name: "POS tagging", area: "Classical NLP", blurb: "Lexical categories in context.", prompt: "Explain part-of-speech tagging methods with examples." },
  { id: "ner", name: "Named Entity Recognition", area: "Classical NLP", blurb: "Finding people, places, dates.", prompt: "Explain named entity recognition with spaCy and NLTK examples." },
  { id: "parsing", name: "Parsing", area: "Classical NLP", blurb: "Constituency & dependency.", prompt: "Explain constituency versus dependency parsing with examples." },
  { id: "syntax", name: "Syntax, semantics, discourse", area: "Classical NLP", blurb: "Levels of linguistic analysis.", prompt: "Explain the levels of linguistic analysis: syntax, semantics and discourse." },
  { id: "tfidf", name: "BoW, one-hot & TF-IDF", area: "Representation", blurb: "Sparse text representations.", prompt: "Teach me TF-IDF step by step." },
  { id: "embeddings", name: "Word embeddings", area: "Representation", blurb: "Word2Vec, GloVe, contextual.", prompt: "Explain word embeddings, Word2Vec and GloVe with examples." },
  { id: "classification", name: "Text classification", area: "Representation", blurb: "Sentiment, spam, topics.", prompt: "Teach me text classification and sentiment analysis with Python code." },
  { id: "mt", name: "MT, summarization & QA", area: "Representation", blurb: "Classic generation tasks.", prompt: "Explain machine translation, summarization and question answering approaches." },
  { id: "rnn", name: "RNNs, LSTMs & seq2seq", area: "Deep learning", blurb: "Sequence modeling basics.", prompt: "Explain RNNs, LSTMs and sequence-to-sequence models with the vanishing gradient issue." },
  { id: "attention", name: "Attention & Transformers", area: "Deep learning", blurb: "The architecture behind everything.", prompt: "Explain the Transformer architecture and attention mechanism." },
  { id: "bert", name: "BERT & GPT-style models", area: "Modern LLM era", blurb: "Transfer learning.", prompt: "Explain BERT and GPT-style models and transfer learning." },
  { id: "llm", name: "LLMs, prompting & RAG", area: "Modern LLM era", blurb: "Modern applications.", prompt: "Explain large language models, prompt engineering and RAG." },
  { id: "evaluation", name: "NLP evaluation", area: "Practice & reliability", blurb: "Metrics that matter.", prompt: "Explain NLP evaluation metrics: accuracy, precision, recall, F1, BLEU, ROUGE and perplexity." },
  { id: "responsible", name: "Deployment & responsible AI", area: "Practice & reliability", blurb: "Bias, privacy, ops.", prompt: "Explain NLP deployment considerations, bias, privacy and responsible AI." },
];

export const TOPIC_AREAS = [
  "Foundations",
  "Classical NLP",
  "Representation",
  "Deep learning",
  "Modern LLM era",
  "Practice & reliability",
] as const;

export const SUGGESTED_PROMPTS = [
  "Explain tokenization with examples.",
  "Teach me TF-IDF step by step.",
  "Explain the Transformer architecture.",
  "Compare stemming and lemmatization.",
  "Generate important NLP exam questions.",
  "Write Python code for sentiment analysis.",
];
