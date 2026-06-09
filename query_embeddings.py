import os
import sys
import json
import argparse
import urllib.request
import tempfile
import uuid
import warnings

# Suppress warnings for cleaner JSON output
warnings.filterwarnings("ignore")

try:
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_community.vectorstores import FAISS
except ImportError as e:
    print(json.dumps({"error": f"Missing library: {str(e)}"}))
    sys.exit(1)

def download_file(url, local_path):
    try:
        # Add user-agent header to avoid potential blocks
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(local_path, 'wb') as out_file:
            out_file.write(response.read())
    except Exception as e:
        print(json.dumps({"error": f"Failed to download {url}: {str(e)}"}))
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Query FAISS embeddings from S3")
    parser.add_argument("--s3_url", required=True, help="S3 URL for index.faiss")
    parser.add_argument("--query", required=True, help="User query string")
    parser.add_argument("--k", type=int, default=3, help="Number of results")
    args = parser.parse_args()

    # The URL ends with index.faiss
    # We need both index.faiss and index.pkl
    faiss_url = args.s3_url
    if not faiss_url.endswith("index.faiss"):
        print(json.dumps({"error": "S3 URL must end with index.faiss"}))
        sys.exit(1)
        
    pkl_url = faiss_url.replace("index.faiss", "index.pkl")

    # Create temporary directory to hold the index
    # Use absolute path to ensure no relative path issues
    temp_dir = os.path.join(tempfile.gettempdir(), f"lms_faiss_{uuid.uuid4().hex}")
    os.makedirs(temp_dir, exist_ok=True)
    
    faiss_path = os.path.join(temp_dir, "index.faiss")
    pkl_path = os.path.join(temp_dir, "index.pkl")

    try:
        # Download files
        download_file(faiss_url, faiss_path)
        download_file(pkl_url, pkl_path)

        # Initialize embedding model
        # Using the same model as create_embeddings.py
        embeddings_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
        
        # Load FAISS index
        vector_db = FAISS.load_local(temp_dir, embeddings_model, allow_dangerous_deserialization=True)
        
        # Perform similarity search
        results = vector_db.similarity_search(args.query, k=args.k)
        
        # Format results
        output = [doc.page_content for doc in results]
        
        print(json.dumps({"success": True, "results": output}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        # Cleanup
        try:
            if os.path.exists(faiss_path): os.remove(faiss_path)
            if os.path.exists(pkl_path): os.remove(pkl_path)
            if os.path.exists(temp_dir): os.rmdir(temp_dir)
        except:
            pass

if __name__ == "__main__":
    # Ensure stdout only has JSON by flushing and redirecting stdout temporarily if needed,
    # but for now we'll just print JSON. Warnings are muted.
    main()
