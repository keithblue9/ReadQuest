from pydantic import BaseModel


class UploadOut(BaseModel):
    key: str
    url: str
    width: int
    height: int
