import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import faiss
from app.config import INDEX_DIR

logger = logging.getLogger(__name__)

# Singleton embedding model holder to avoid reloading weights repeatedly
_model_instance = None

def get_embedding_model():
    global _model_instance
    if _model_instance is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Using lightweight, fast, highly-accurate 384-dim model
            _model_instance = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Loaded sentence-transformers all-MiniLM-L6-v2 model successfully.")
        except Exception as e:
            logger.warning(f"Could not load sentence-transformers ({e}). Using lightweight bag-of-ngrams embedding fallback.")
            _model_instance = "fallback"
    return _model_instance

def compute_fallback_embedding(text: str, dim: int = 384) -> np.ndarray:
    """Deterministic, fast bag-of-ngrams hash embedding if sentence-transformers is unavailable."""
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    if not words:
        return vec
    for word in words:
        idx = hash(word) % dim
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec

def encode_texts(texts: List[str]) -> np.ndarray:
    """Encodes a list of texts into normalized float32 vectors."""
    model = get_embedding_model()
    if model != "fallback":
        try:
            embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            return embeddings.astype(np.float32)
        except Exception as e:
            logger.error(f"Error encoding with model: {e}. Falling back.")
    
    # Fallback encoding
    embeddings = [compute_fallback_embedding(t) for t in texts]
    return np.array(embeddings, dtype=np.float32)

class CourseVectorStore:
    """
    Manages isolated FAISS indexes for each individual course.
    """

    @staticmethod
    def get_index_path(course_id: str) -> Path:
        return INDEX_DIR / f"{course_id}.faiss"

    @staticmethod
    def get_meta_path(course_id: str) -> Path:
        return INDEX_DIR / f"{course_id}_meta.json"

    @classmethod
    def add_chunks(cls, course_id: str, new_chunks: List[Dict[str, Any]]) -> int:
        """
        Embeds and stores chunks in the course's isolated index.
        """
        if not new_chunks:
            return 0

        texts = [c["content"] for c in new_chunks]
        embeddings = encode_texts(texts)
        dimension = embeddings.shape[1]

        index_path = cls.get_index_path(course_id)
        meta_path = cls.get_meta_path(course_id)

        existing_meta = []
        if index_path.exists() and meta_path.exists():
            try:
                index = faiss.read_index(str(index_path))
                with open(meta_path, "r", encoding="utf-8") as f:
                    existing_meta = json.load(f)
            except Exception as e:
                logger.error(f"Failed to read existing index for course {course_id}: {e}")
                index = faiss.IndexFlatIP(dimension)
                existing_meta = []
        else:
            # Inner Product on normalized vectors is Cosine Similarity
            index = faiss.IndexFlatIP(dimension)

        # Add vectors
        index.add(embeddings)
        all_meta = existing_meta + new_chunks

        # Save to disk
        faiss.write_index(index, str(index_path))
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(all_meta, f, ensure_ascii=False, indent=2)

        return len(new_chunks)

    @classmethod
    def search(cls, course_id: str, query: str, top_k: int = 4) -> List[Dict[str, Any]]:
        """
        Queries the course-isolated FAISS index and returns top relevant chunks.
        """
        index_path = cls.get_index_path(course_id)
        meta_path = cls.get_meta_path(course_id)

        if not index_path.exists() or not meta_path.exists():
            return []

        try:
            index = faiss.read_index(str(index_path))
            with open(meta_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            if not metadata or index.ntotal == 0:
                return []

            query_vec = encode_texts([query])
            actual_k = min(top_k, index.ntotal)
            distances, indices = index.search(query_vec, actual_k)

            results = []
            for score, idx in zip(distances[0], indices[0]):
                if 0 <= idx < len(metadata):
                    item = dict(metadata[idx])
                    item["relevance_score"] = float(score)
                    results.append(item)

            return results
        except Exception as e:
            logger.error(f"Search failed for course {course_id}: {e}")
            return []

    @classmethod
    def delete_course_index(cls, course_id: str):
        """Removes the FAISS index and metadata files for a course."""
        index_path = cls.get_index_path(course_id)
        meta_path = cls.get_meta_path(course_id)
        if index_path.exists():
            try:
                os.remove(index_path)
            except OSError:
                pass
        if meta_path.exists():
            try:
                os.remove(meta_path)
            except OSError:
                pass

    @classmethod
    def get_chunk_count(cls, course_id: str) -> int:
        """Returns total indexed chunk count for a course."""
        meta_path = cls.get_meta_path(course_id)
        if meta_path.exists():
            try:
                with open(meta_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return len(data)
            except Exception:
                return 0
        return 0
