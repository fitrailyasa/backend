from django.urls import path, re_path
from drf_spectacular.views import SpectacularSwaggerView

from apps.core.schema import openapi_document

from apps.accounts.views import (
    LoginView,
    LogoutView,
    MeView,
    RefreshView,
    RegisterView,
    UserCollectionView,
    UserDetailView,
    UserMeView,
)
from apps.catalog.views import (
    CategoryCollectionView,
    CategoryDetailView,
    ProductCollectionView,
    ProductDetailView,
    TagCollectionView,
    TagDetailView,
)
from apps.comments.views import CommentCollectionView, CommentDetailView, ProductCommentView
from apps.core.views import ApiIndexView, HealthView, not_found
from apps.orders.views import OrderCollectionView, OrderDetailView, OrderStatusView

handler404 = 'apps.core.views.not_found'
handler500 = 'apps.core.views.server_error'

urlpatterns = [
    path('api/v1/docs.json', openapi_document, name='schema'),
    path('api/v1/docs', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('health', HealthView.as_view()),
    path('api/v1', ApiIndexView.as_view()),
    path('api/v1/auth/register', RegisterView.as_view()),
    path('api/v1/auth/login', LoginView.as_view()),
    path('api/v1/auth/refresh', RefreshView.as_view()),
    path('api/v1/auth/logout', LogoutView.as_view()),
    path('api/v1/auth/me', MeView.as_view()),
    path('api/v1/users/me', UserMeView.as_view()),
    path('api/v1/users', UserCollectionView.as_view()),
    path('api/v1/users/<str:pk>', UserDetailView.as_view()),
    path('api/v1/categories', CategoryCollectionView.as_view()),
    path('api/v1/categories/<str:pk>', CategoryDetailView.as_view()),
    path('api/v1/products/<str:product_id>/comments', ProductCommentView.as_view()),
    path('api/v1/products', ProductCollectionView.as_view()),
    path('api/v1/products/<str:pk>', ProductDetailView.as_view()),
    path('api/v1/tags', TagCollectionView.as_view()),
    path('api/v1/tags/<str:pk>', TagDetailView.as_view()),
    path('api/v1/orders', OrderCollectionView.as_view()),
    path('api/v1/orders/<str:pk>/status', OrderStatusView.as_view()),
    path('api/v1/orders/<str:pk>', OrderDetailView.as_view()),
    path('api/v1/comments', CommentCollectionView.as_view()),
    path('api/v1/comments/<str:pk>', CommentDetailView.as_view()),
    re_path(r'^.*$', not_found),
]
