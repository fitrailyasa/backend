from apps.accounts.authentication import JWTAuthentication
from apps.comments import services
from apps.core.permissions import IsAuthenticated
from apps.core.responses import created, ok, paginated
from apps.core.views import AuthView, MethodGateMixin, PublicView


class CommentCollectionView(PublicView):
    def get(self, request):
        rows, meta = services.list_comments(request.query_params)
        return paginated('Comments retrieved', rows, meta)


class CommentDetailView(AuthView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        return ok('Comment updated successfully', services.update_comment(pk, request.data, request.user))

    def delete(self, request, pk):
        services.delete_comment(pk, request.user)
        return ok('Comment deleted successfully', None)


class ProductCommentView(MethodGateMixin, PublicView):
    public_methods = frozenset({'GET', 'HEAD', 'OPTIONS'})

    def get(self, request, product_id):
        rows, meta = services.list_comments(request.query_params, product_id=product_id)
        return paginated('Comments retrieved', rows, meta)

    def post(self, request, product_id):
        return created(
            'Comment created successfully',
            services.create_comment(product_id, request.data, request.user),
        )
