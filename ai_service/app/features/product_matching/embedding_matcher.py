from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# Load the AI model once when the service starts
# Model: Multilingual MiniLM 12-layer Transformer (384 dimensions)
model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")


def get_embedding(text: str):
    """
    Convert text into a numerical vector using the AI model.
    """
    return model.encode([text])


def calculate_semantic_similarity(text1: str, text2: str) -> float:
    """
    Calculate semantic similarity between two product names using Cosine Distance.
    """
    embedding1 = get_embedding(text1)
    embedding2 = get_embedding(text2)

    score = cosine_similarity(embedding1, embedding2)[0][0]

    return float(score)
