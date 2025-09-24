from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import SaleViewSet

router = DefaultRouter()
router.register(r'', SaleViewSet, basename='Sale')

urlpatterns = [
    path('last_invoice/', SaleViewSet.as_view({'get': 'last_invoice'}), name='last-invoice'),
    path('summary/', SaleViewSet.as_view({'get': 'summary'}), name='sales-summary'),
] + router.urls