from app.features.product_matching.embedding_matcher import calculate_semantic_similarity


score = calculate_semantic_similarity(
    "Maggi noodles",
    "Maggi"
)

print("Semantic similarity:", score)