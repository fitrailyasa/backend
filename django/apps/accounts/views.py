from apps.accounts.authentication import JWTAuthentication, extract_bearer
from apps.accounts.blacklist import blacklist_token
from apps.accounts.services import (
    create_user,
    delete_user,
    get_user,
    list_users,
    login,
    register,
    update_profile,
    update_user,
)
from apps.accounts.tokens import verify_refresh_token
from apps.accounts.models import User
from apps.accounts.serializers import serialize_user
from apps.core.exceptions import ApiError
from apps.core.permissions import IsAdmin, IsAuthenticated
from apps.core.ratelimit import client_ip, enforce_rate_limit
from apps.core.responses import created, ok, paginated
from apps.core.validate import parse_pk
from apps.core.views import AdminView, AuthView, PublicView


class RegisterView(PublicView):
    def post(self, request):
        enforce_rate_limit(request)
        return created('User registered successfully', register(request.data))


class LoginView(PublicView):
    def post(self, request):
        enforce_rate_limit(request)
        return ok('Login successful', login(request.data, client_ip(request)))


class RefreshView(PublicView):
    def post(self, request):
        enforce_rate_limit(request)
        data = request.data if isinstance(request.data, dict) else {}
        token = None
        if isinstance(data, dict):
            token = data.get('refresh_token') or data.get('token')
        if not token:
            token = extract_bearer(request)
        if not isinstance(token, str) or not token.strip():
            raise ApiError.unauthorized('Refresh token is missing')
        payload = verify_refresh_token(token.strip())
        user = User.objects.filter(pk=payload.get('sub')).first()
        if user is None:
            raise ApiError.unauthorized('Token is invalid')
        body = {'user': serialize_user(user)}
        from apps.accounts.tokens import issue_token_pair

        body.update(issue_token_pair(user))
        return ok('Token refreshed successfully', body)


class LogoutView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        blacklist_token(request.auth)
        return ok('Logged out successfully', None)


class MeView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.filter(pk=request.user.pk).first()
        if user is None:
            raise ApiError.unauthorized('Token is invalid')
        return ok('Authenticated user retrieved', serialize_user(user))


class UserCollectionView(AdminView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]

    def get(self, request):
        rows, meta = list_users(request.query_params)
        return paginated('Users retrieved', rows, meta)

    def post(self, request):
        return created('User created successfully', create_user(request.data))


class UserMeView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = User.objects.filter(pk=request.user.pk).first()
        if user is None:
            raise ApiError.unauthorized('Token is invalid')
        return ok('User retrieved', serialize_user(user))

    def patch(self, request):
        return ok('Profile updated successfully', update_profile(request.user.pk, request.data))


class UserDetailView(AdminView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAdmin]

    def get(self, request, pk):
        return ok('User retrieved', get_user(parse_pk(pk)))

    def put(self, request, pk):
        return ok('User updated successfully', update_user(parse_pk(pk), request.data, partial=False))

    def patch(self, request, pk):
        return ok('User updated successfully', update_user(parse_pk(pk), request.data, partial=True))

    def delete(self, request, pk):
        delete_user(parse_pk(pk))
        return ok('User deleted successfully', None)
