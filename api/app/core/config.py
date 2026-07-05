from functools import lru_cache
from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    environment: str = Field(default="local", validation_alias="ENVIRONMENT")
    cors_origins: str = Field(default="http://localhost:3000,http://127.0.0.1:3000", validation_alias="CORS_ORIGINS")
    supabase_url: AnyHttpUrl = Field(validation_alias="SUPABASE_URL")
    supabase_publishable_key: str = Field(validation_alias="SUPABASE_PUBLISHABLE_KEY")
    supabase_secret_key: str = Field(validation_alias="SUPABASE_SECRET_KEY")
    supabase_jwks_url: AnyHttpUrl = Field(validation_alias="SUPABASE_JWKS_URL")
    supabase_issuer: str = Field(validation_alias="SUPABASE_ISSUER")
    supabase_storage_bucket: str = Field(validation_alias="SUPABASE_STORAGE_BUCKET")
    max_material_file_bytes: int = Field(default=52428800, validation_alias="MAX_MATERIAL_FILE_BYTES")
    openai_api_key: str = Field(validation_alias="OPENAI_API_KEY")
    embedding_model: str = Field(default="text-embedding-3-small", validation_alias="EMBEDDING_MODEL")
    embedding_dimension: int = Field(default=1536, validation_alias="EMBEDDING_DIMENSION")
    embedding_batch_size: int = Field(default=64, validation_alias="EMBEDDING_BATCH_SIZE")
    embedding_max_retries: int = Field(default=3, validation_alias="EMBEDDING_MAX_RETRIES")
    anthropic_api_key: str = Field(validation_alias="ANTHROPIC_API_KEY")
    generation_model: str = Field(default="claude-sonnet-4-6", validation_alias="GENERATION_MODEL")
    generation_max_tokens: int = Field(default=32000, validation_alias="GENERATION_MAX_TOKENS")
    generation_retrieval_k: int = Field(default=14, validation_alias="GENERATION_RETRIEVAL_K")
    # Cosine distance cutoff: chunks farther than this are treated as irrelevant
    # and dropped, so off-topic material can't ground generation. 0=identical, 2=opposite.
    generation_max_distance: float = Field(default=0.65, validation_alias="GENERATION_MAX_DISTANCE")

@lru_cache
def get_settings() -> Settings:
    return Settings() # type: ignore[call-arg]