from apps.catalog import services
from apps.core.responses import created, ok, paginated
from apps.core.validate import parse_pk
from apps.core.views import MethodGateMixin, PublicView


class CategoryCollectionView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'POST'})

    def get(self, request):
        rows, meta = services.list_categories(request.query_params)
        return paginated('Categories retrieved', rows, meta)

    def post(self, request):
        return created('Category created successfully', services.create_category(request.data))


class CategoryDetailView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'PUT', 'PATCH', 'DELETE'})

    def get(self, request, pk):
        return ok('Category retrieved', services.get_category(parse_pk(pk), request.query_params))

    def put(self, request, pk):
        return ok('Category updated successfully', services.update_category(parse_pk(pk), request.data, False))

    def patch(self, request, pk):
        return ok('Category updated successfully', services.update_category(parse_pk(pk), request.data, True))

    def delete(self, request, pk):
        services.delete_category(parse_pk(pk))
        return ok('Category deleted successfully', None)


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


class TagCollectionView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'POST'})

    def get(self, request):
        rows, meta = services.list_tags(request.query_params)
        return paginated('Tags retrieved', rows, meta)

    def post(self, request):
        return created('Tag created successfully', services.create_tag(request.data))


class TagDetailView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})
    admin_methods = frozenset({'PUT', 'PATCH', 'DELETE'})

    def get(self, request, pk):
        return ok('Tag retrieved', services.get_tag(parse_pk(pk)))

    def put(self, request, pk):
        return ok('Tag updated successfully', services.update_tag(parse_pk(pk), request.data, False))

    def patch(self, request, pk):
        return ok('Tag updated successfully', services.update_tag(parse_pk(pk), request.data, True))

    def delete(self, request, pk):
        services.delete_tag(parse_pk(pk))
        return ok('Tag deleted successfully', None)
