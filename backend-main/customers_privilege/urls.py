from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PrivilegeCardViewSet, CustomerViewSet

router = DefaultRouter()
router.register(r'privilege-cards', PrivilegeCardViewSet, basename='privilegecard')
router.register(r'customers', CustomerViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]