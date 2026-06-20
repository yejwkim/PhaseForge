from time import sleep
from openai import OpenAI
from app.core.config import get_settings

def get_openai_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(api_key=settings.openai_api_key)


def batch_items(items: list[str], batch_size: int) -> list[list[str]]:
    if batch_size <= 0:
        raise ValueError("batch_size must be positive")

    return [items[index : index + batch_size] for index in range(0, len(items), batch_size)]

def validate_embeddings(texts: list[str], embeddings: list[list[float]], exp_dim: int) -> None:
    if len(embeddings) != len(texts):
        raise ValueError(f"Expected {len(texts)} embeddings, received {len(embeddings)}")
    
    for index, embedding in enumerate(embeddings):
        if len(embedding) != exp_dim:
            raise ValueError(f"Embedding {index} has dimension {len(embedding)}, expected {exp_dim}")

def embed_batch_with_retries(client: OpenAI, batch: list[str], model:str, max_retries: int
                             ) -> list[list[float]]:
    last_error: Exception | None = None
    
    for attempt in range(max_retries + 1):
        try:
            response = client.embeddings.create(model=model, input=batch)
            return [item.embedding for item in response.data]
        except Exception as exc:
            last_error = exc
            if attempt >= max_retries:
                break
            sleep(0.5 * (2 ** attempt))
    
    raise RuntimeError(f"Embedding request failed after retries: {last_error}")

def generate_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    
    settings = get_settings()
    client = get_openai_client()
    
    all_embeddings: list[list[float]] = []
    
    for batch in batch_items(texts, settings.embedding_batch_size):
        batch_embeddings = embed_batch_with_retries(client, batch, settings.embedding_model,
                                                    settings.embedding_max_retries)
        all_embeddings.extend(batch_embeddings)
    
    validate_embeddings(texts, all_embeddings, settings.embedding_dimension)
    
    return all_embeddings
