from rest_framework.permissions import BasePermission

from apps.core.exceptions import ApiError


def _authenticated(request):
    user = getattr(request, 'user', None)
    return user is not None and getattr(user, 'is_authenticated', False)


class IsAuthenticated(BasePermission):
    def has_permission(self, request, view):
        if not _authenticated(request):
            raise ApiError.unauthorized('Authentication token is missing')
        return True


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        if not _authenticated(request):
            raise ApiError.unauthorized('Authentication token is missing')
        if getattr(request.user, 'role', None) != 'admin':
            raise ApiError.forbidden('This action is unauthorized')
        return True
