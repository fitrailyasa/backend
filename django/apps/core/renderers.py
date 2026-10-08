from decimal import Decimal

from rest_framework.renderers import JSONRenderer
from rest_framework.utils.encoders import JSONEncoder


class ApiJSONEncoder(JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


class ApiJSONRenderer(JSONRenderer):
    encoder_class = ApiJSONEncoder
    ensure_ascii = False
