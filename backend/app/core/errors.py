from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Error bisnis yang dikirim ke klien sebagai `{"error": {"code", "message"}}`."""

    def __init__(
        self, status_code: int, code: str, message: str, details: dict | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def unauthorized(message: str = "Autentikasi diperlukan", code: str = "unauthorized") -> AppError:
    return AppError(401, code, message)


def forbidden(message: str = "Akses ditolak") -> AppError:
    return AppError(403, "forbidden", message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message, **exc.details}},
            headers=headers,
        )
