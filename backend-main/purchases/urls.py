from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PurchaseViewSet

router = DefaultRouter()
router.register(r'', PurchaseViewSet, basename='purchase')

urlpatterns = [
    path('', include(router.urls)),
    path('api/purchases/next_invoice_number/', PurchaseViewSet.as_view({'get': 'next_invoice_number'}), name='purchase-next-invoice'),
]