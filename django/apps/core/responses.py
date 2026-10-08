from rest_framework.response import Response


def ok(message, data=None, status=200):
    return Response({'success': True, 'message': message, 'data': data}, status=status)


def created(message, data=None):
    return Response({'success': True, 'message': message, 'data': data}, status=201)


def paginated(message, data, meta):
    return Response(
        {'success': True, 'message': message, 'data': data, 'meta': meta},
        status=200,
    )
