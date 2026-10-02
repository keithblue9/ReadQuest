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
    PlainSerializer(str, return_type=str),
    WithJsonSchema({"type": "string", "pattern": "^[0-9a-f]{24}$"}),
]
