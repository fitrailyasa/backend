from pathlib import Path

from django.http import HttpResponse
from drf_spectacular.drainage import GENERATOR_STATS
from drf_spectacular.extensions import OpenApiAuthenticationExtension

GENERATOR_STATS.silent = True

_SPEC = Path(__file__).with_name("openapi.json")


def openapi_document(_request):
    return HttpResponse(_SPEC.read_bytes(), content_type="application/json")


class JWTAuthScheme(OpenApiAuthenticationExtension):
    target_class = 'apps.accounts.authentication.JWTAuthentication'
    name = 'bearerAuth'

    def get_security_definition(self, auto_schema):
        return {'type': 'http', 'scheme': 'bearer', 'bearerFormat': 'JWT'}
