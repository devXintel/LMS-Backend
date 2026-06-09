import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

# -------------------------
# Paths
# -------------------------
EMBEDDINGS_ROOT = "embeddings/stateboard/class1"

# -------------------------
# Initialize embedding model
# -------------------------
embeddings_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# -------------------------
# Function to load all embeddings in the folder
# -------------------------
def load_all_embeddings(root_path):
    vector_dbs = {}
    
    for book_name in os.listdir(root_path):
        book_path = os.path.join(root_path, book_name)
        if os.path.isdir(book_path):
            try:
                vector_db = FAISS.load_local(book_path, embeddings_model, allow_dangerous_deserialization=True)
                vector_dbs[book_name] = vector_db
                print(f"✅ Loaded embeddings → {book_name}")
            except Exception as e:
                print(f"⚠ Failed to load {book_name}: {e}")
    
    return vector_dbs

# -------------------------
# Load all embeddings
# -------------------------
vector_databases = load_all_embeddings(EMBEDDINGS_ROOT)

# -------------------------
# Example: query a book
# -------------------------
query = "What is addition?"
if "maths_evs_book" in vector_databases:
    results = vector_databases["maths_evs_book"].similarity_search(query, k=3)

    print("\nTop results from Maths+EVS book:")
    for i, doc in enumerate(results, 1):
        print(f"{i}. {doc.page_content[:200]}...")  # Print first 200 chars
else:
    print("\n⚠ 'maths_evs_book' embeddings not found.")
