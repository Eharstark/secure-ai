from pydantic import BaseModel


class RootResponse(BaseModel):
    name: str
    message: str
