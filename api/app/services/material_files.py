from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from app.core.supabase import get_supabase_client
from app.core.config import get_settings

ALLOWED_MATERIAL_TYPES = {"syllabus", "lecture", "notes", "past_exam"}
ALLOWED_FILE_FORMAT = {".pdf"}

def validate_material_file_metadata(material: dict[str, Any]) -> None:
    storage_path = material.get("storage_path")
    filename = material.get("filename")
    material_type = material.get("type")
    
    if not isinstance(storage_path, str) or not storage_path.strip():
        raise ValueError("Material is missing storage_path")

    if not isinstance(filename, str) or not filename.strip():
        raise ValueError("Material is missing filename")
    
    if material_type not in ALLOWED_MATERIAL_TYPES:
        raise ValueError(f"Unsupported material type: {material_type}")
    
    suffix = Path(filename).suffix.lower()
    
    if suffix not in ALLOWED_FILE_FORMAT:
        raise ValueError(f"Unsupported material file type: {suffix or 'unknown'}")

def download_material_file(storage_path: str) -> bytes:
    settings = get_settings()
    supabase = get_supabase_client()
    
    return supabase.storage.from_(settings.supabase_storage_bucket).download(storage_path)

def write_temp_material_file(file_bytes: bytes, filename: str) -> Path:
    settings = get_settings()
    if len(file_bytes) > settings.max_material_file_bytes:
        raise ValueError("Material file exceeds maximum allowed size")
    
    suffix = Path(filename).suffix.lower()
    
    if suffix not in ALLOWED_FILE_FORMAT:
        raise ValueError(f"Unsupported material file type: {suffix or 'unknown'}")
    
    with NamedTemporaryFile(mode="wb", suffix=suffix, prefix="phaseforge-material-", delete=False) as temp_file:
        temp_file.write(file_bytes)
        return Path(temp_file.name)
