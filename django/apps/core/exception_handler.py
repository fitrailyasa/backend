import logging

from django.http import Http404
from rest_framework.exceptions import ParseError, UnsupportedMediaType
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.core.exceptions import ApiError

logger = logging.getLogger('apps')


def api_exception_handler(exc, context):
    if isinstance(exc, ApiError):
        body = {'success': False, 'message': exc.message}
        if exc.status_code == 422 and exc.errors:
            body['errors'] = exc.errors
        return Response(body, status=exc.status_code, headers=getattr(exc, 'headers', None))

    if isinstance(exc, (ParseError, UnsupportedMediaType)):
        return Response({'success': False, 'message': 'Invalid JSON payload'}, status=400)

    if isinstance(exc, Http404):
        return Response({'success': False, 'message': 'Resource not found'}, status=404)

    response = exception_handler(exc, context)
    if response is not None:
        status_code = response.status_code
        detail = getattr(exc, 'detail', None)
        message = _stringify(detail) if detail else 'Request failed'
        if status_code == 401:
            message = _stringify(detail) or 'Unauthenticated'
        elif status_code == 403:
            message = 'This action is unauthorized'
        elif status_code == 404:
            message = 'Resource not found'
        elif status_code == 429:
            message = 'Too many requests, please try again later'
        elif status_code >= 500:
            message = 'Internal server error'
        body = {'success': False, 'message': message}
        if status_code == 422 and isinstance(detail, dict):
            body['errors'] = detail
        return Response(body, status=status_code, headers=response.headers)

    logger.exception('Unhandled error on %s', getattr(context.get('request'), 'path', '-'), exc_info=exc)
    return Response({'success': False, 'message': 'Internal server error'}, status=500)


def _stringify(detail):
    if detail is None:
        return ''
    if isinstance(detail, str):
        return detail
    if isinstance(detail, (list, tuple)):
        return _stringify(detail[0]) if detail else ''
    return str(detail)
