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
