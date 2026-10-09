from apps.catalog import services
from apps.core.responses import created, ok, paginated
from apps.core.validate import parse_pk
from apps.core.views import MethodGateMixin, PublicView


class ProductCollectionView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'POST'})

    def get(self, request):
        rows, meta = services.list_products(request.query_params)
        return paginated('Products retrieved', rows, meta)

    def post(self, request):
        return created('Product created successfully', services.create_product(request.data))


class ProductDetailView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'PUT', 'PATCH', 'DELETE'})

    def get(self, request, pk):
        return ok('Product retrieved', services.get_product(parse_pk(pk), request.query_params))

    def put(self, request, pk):
        return ok('Product updated successfully', services.update_product(parse_pk(pk), request.data, False))

    def patch(self, request, pk):
        return ok('Product updated successfully', services.update_product(parse_pk(pk), request.data, True))

    def delete(self, request, pk):
        services.delete_product(parse_pk(pk))
        return ok('Product deleted successfully', None)
