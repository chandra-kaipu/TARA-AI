# CS 101: Foundations of Artificial Intelligence & Retrieval Systems
Course Instructor: Dr. Katherine Vance | Term: Fall 2026 | Department of Computer Science

## Course Overview & Prerequisites
This course provides a rigorous, hands-on introduction to modern computational intelligence. Prerequisites include single-variable calculus, linear algebra, and basic proficiency in Python. Grading is weighted: 40% hands-on laboratory assignments, 25% midterm examination, 25% final project, and 10% classroom participation.

## Module 1: Vector Spaces and Dense Embeddings
Traditional symbolic retrieval models such as BM25 and TF-IDF rely on lexical surface matching, making them vulnerable to vocabulary mismatch and synonymy. Modern vector retrieval addresses this limitation by mapping discrete textual units (words, sentences, or paragraphs) into continuous multi-dimensional geometric spaces (typically 384 to 1536 dimensions). 
In dense vector spaces, semantically similar concepts cluster together. Distance metrics such as Cosine Similarity (the cosine of the angle between two unit-normalized vectors) and Inner Product are computed to measure relevance. High-dimensional vector indexing is accelerated using approximate nearest neighbor (ANN) graph algorithms, such as Hierarchical Navigable Small World (HNSW) and inverted file indexing (IVF-Flat) implemented in libraries like FAISS.

## Module 2: Retrieval-Augmented Generation (RAG) Architecture
Retrieval-Augmented Generation (RAG) combines dense semantic retrieval with parametric language models. Rather than relying solely on the static, potentially outdated parameters of a foundation model, a RAG pipeline dynamically fetches relevant context chunks from an external knowledge base and injects them into the prompt.
A standard RAG pipeline operates in three discrete stages:
1. Ingestion and Indexing: Source documents are parsed, stripped of formatting noise, and segmented into overlapping text chunks (typically 500 to 1000 characters with 10% to 20% overlap). Overlap preserves syntactic context across segment boundaries.
2. Retrieval: When a user query arrives, it is embedded using the same vector model, and the top-k most similar chunks are retrieved via vector search.
3. Grounded Synthesis: The retrieved chunks are assembled into a context prompt with explicit instructions requiring the model to cite sources and reject hallucination when information is absent.

## Module 3: Autonomous AI Agents and Tool Orchestration
An AI agent differs from a passive conversational model in its ability to perceive external environments and execute actions. Agents operate via a continuous perception-cognition-action loop:
1. Perception: Ingesting multimodal inputs including text, audio, and visual displays.
2. Cognition & Planning: Decomposing high-level goals into sequential sub-tasks.
3. Tool Execution: Generating structured function calls (e.g., JSON schemas) to trigger external APIs, database transactions, web search, or OS-level commands.
Crucially, production agent architectures enforce a Human-in-the-Loop (HITL) permission gate before executing privileged operations, such as modifying file systems, launching applications, or initiating web browsing sessions.

## Examination Policies and Office Hours
The midterm examination will take place during Week 7, covering Modules 1 through 3. All students are permitted one double-sided A4 handwritten reference sheet. Office hours are held Tuesdays and Thursdays from 2:00 PM to 4:00 PM in Alan Turing Hall, Room 304, or via the interactive study portal.
