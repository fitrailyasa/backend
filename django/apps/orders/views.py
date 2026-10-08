from apps.accounts.authentication import JWTAuthentication
from apps.core.permissions import IsAuthenticated
from apps.core.responses import created, ok, paginated
from apps.core.validate import parse_pk
from apps.core.views import AuthView, MethodGateMixin, PublicView
from apps.orders import services


class OrderCollectionView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rows, meta = services.list_orders(request.query_params, request.user)
        return paginated('Orders retrieved', rows, meta)

    def post(self, request):
        return created('Order created successfully', services.create_order(request.user, request.data))


class OrderDetailView(MethodGateMixin, PublicView):
    admin_methods = frozenset({'DELETE'})

    def get(self, request, pk):
        return ok('Order retrieved', services.get_order(parse_pk(pk), request.user, request.query_params))

    def delete(self, request, pk):
        services.delete_order(parse_pk(pk), request.user)
        return ok('Order deleted successfully', None)


class OrderStatusView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        return ok('Order status updated successfully', services.update_status(parse_pk(pk), request.data, request.user))
