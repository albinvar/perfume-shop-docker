from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SupplierViewSet, SupplierTransactionViewSet, SupplierReportView

router = DefaultRouter()
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'supplier-transactions', SupplierTransactionViewSet, basename='supplier-transaction')

urlpatterns = [
    path('', include(router.urls)),
    path('report/', SupplierReportView.as_view(), name='supplier-report'),
]