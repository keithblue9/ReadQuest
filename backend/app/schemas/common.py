from typing import Annotated

from bson import ObjectId
from pydantic import PlainSerializer, PlainValidator, WithJsonSchema


def _to_object_id(value: object) -> ObjectId:
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    raise ValueError("ID tidak valid")


PyObjectId = Annotated[
    ObjectId,
    PlainValidator(_to_object_id),
    # Hanya saat serialisasi JSON; model_dump() biasa tetap ObjectId (untuk query MongoDB).
    PlainSerializer(str, return_type=str, when_used="json"),
    WithJsonSchema({"type": "string", "pattern": "^[0-9a-f]{24}$"}),
]
