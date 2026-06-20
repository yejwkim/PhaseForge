from pydantic import BaseModel
from fastapi import HTTPException, status, Header
from functools import lru_cache
from jwt import PyJWKClient, decode, ExpiredSignatureError, InvalidTokenError
from app.core.config import get_settings

class AuthenticatedUser(BaseModel):
    id: str
    role: str | None = None
    email: str | None = None
    
def extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    
    scheme, _, token = authorization.partition(" ")
    
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    
    return token

@lru_cache
def get_jwks_client() -> PyJWKClient:
    settings = get_settings()
    return PyJWKClient(str(settings.supabase_jwks_url))

def decode_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    jwks_client = get_jwks_client()
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    
    return decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        issuer=str(settings.supabase_issuer),
        audience="authenticated",
        options={"require": ["exp", "sub", "iss", "aud"]}
    )
    
def user_from_claims(claims: dict) -> AuthenticatedUser:
    user_id = claims.get("sub")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing subject claim")
    
    if claims.get("role") != "authenticated":
        raise HTTPException(status_code=401, detail="Invalid role")
    
    return AuthenticatedUser(
        id = user_id,
        role = claims.get("role"),
        email = claims.get("email")
    )
    
def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )
    
async def get_current_user(authorization: str | None = Header(default=None, alias="Authorization"),) -> AuthenticatedUser:
    token = extract_bearer_token(authorization)
    
    try:
        claims = decode_supabase_jwt(token)
    except ExpiredSignatureError:
        raise unauthorized("Token expired")
    except InvalidTokenError:
        raise unauthorized("Invalid token")

    return user_from_claims(claims)