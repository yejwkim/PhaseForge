from uuid import UUID
from pydantic import BaseModel

class IngestRequest(BaseModel):
    material_id: UUID
    
class IngestResponse(BaseModel):
    material_id: UUID
    status: str