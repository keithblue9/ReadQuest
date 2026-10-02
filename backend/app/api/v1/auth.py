from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status

from app.api.deps import Db, client_info
from app.core.config import get_settings
from app.core.rate_limit import rate_limiter
from app.schemas.auth import LoginIn, RegisterIn, TokenOut
from app.services import auth_service, user_service
from app.services.auth_service import ClientInfo, IssuedTokens

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE_NAME = "rq_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

Client = Annotated[ClientInfo, Depends(client_info)]


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        max_age=settings.jwt_refresh_ttl_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path=REFRESH_COOKIE_PATH,
    )


async def _token_response(db: Db, response: Response, issued: IssuedTokens) -> TokenOut:
    _set_refresh_cookie(response, issued.refresh_token)
    response.headers["Cache-Control"] = "no-store"
    return TokenOut(
        access_token=issued.access_token,
        expires_in=issued.expires_in,
        user=await user_service.build_me(db, issued.user),
    )


RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)]


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterIn, db: Db, response: Response, client: Client) -> TokenOut:
    rate_limiter.hit(f"register:ip:{client.ip}", limit=5, window_seconds=60)
    issued = await auth_service.register(db, data, client)
    return await _token_response(db, response, issued)


@router.post("/login", response_model=TokenOut)
async def login(data: LoginIn, db: Db, response: Response, client: Client) -> TokenOut:
    rate_limiter.hit(f"login:ip:{client.ip}", limit=20, window_seconds=60)
    rate_limiter.hit(f"login:email:{data.email.lower()}", limit=5, window_seconds=60)
    issued = await auth_service.login(db, data, client)
    return await _token_response(db, response, issued)


@router.post("/refresh", response_model=TokenOut)
async def refresh(
    db: Db, response: Response, client: Client, rq_refresh: RefreshCookie = None
) -> TokenOut:
    rate_limiter.hit(f"refresh:ip:{client.ip}", limit=60, window_seconds=60)
    issued = await auth_service.refresh(db, rq_refresh, client)
    return await _token_response(db, response, issued)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(db: Db, response: Response, rq_refresh: RefreshCookie = None) -> Response:
    await auth_service.logout(db, rq_refresh)
    _clear_refresh_cookie(response)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
