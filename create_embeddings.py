import os
import argparse
import shutil
from langchain_community.document_loaders import PDFMinerLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

# ----------------------------
# CONFIGURATION
# ----------------------------
embeddings_model = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=100
)

# ----------------------------
# PROCESS SINGLE FILE
# ----------------------------
def process_file(pdf_path, output_dir):
    print(f"Processing -> {pdf_path}")
    
    if not os.path.exists(pdf_path):
        print(f"Error: File not found at {pdf_path}")
        return

    # Load PDF
    loader = PDFMinerLoader(pdf_path)
    documents = loader.load()

    # Split text
    docs = text_splitter.split_documents(documents)

    # Create embeddings
    vector_store = FAISS.from_documents(docs, embeddings_model)

    # Save
    os.makedirs(output_dir, exist_ok=True)
    vector_store.save_local(output_dir)
    print(f"Saved embeddings to -> {output_dir}")

# ----------------------------
# BATCH PROCESS (Original Logic)
# ----------------------------
def batch_process(notes_root, embeddings_root):
    for board in os.listdir(notes_root):
        board_path = os.path.join(notes_root, board)
        if not os.path.isdir(board_path): continue

        for class_name in os.listdir(board_path):
            class_path = os.path.join(board_path, class_name)
            if not os.path.isdir(class_path): continue

            for file in os.listdir(class_path):
                if not file.lower().endswith(".pdf"): continue

                book_name = file.replace(".pdf", "")
                pdf_path = os.path.join(class_path, file)
                save_path = os.path.join(embeddings_root, board, class_name, book_name)
                
                process_file(pdf_path, save_path)

# ----------------------------
# MAIN
# ----------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create FAISS embeddings from PDFs")
    parser.add_argument("--pdf_path", help="Path to a single PDF file")
    parser.add_argument("--output_dir", help="Output directory for embeddings")
    parser.add_argument("--batch", action="store_true", help="Run batch process on 'notes' folder")
    
    args = parser.parse_args()

    if args.batch:
        batch_process("notes", "embeddings")
    elif args.pdf_path and args.output_dir:
        process_file(args.pdf_path, args.output_dir)
    else:
        parser.print_help()
