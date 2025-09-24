from django.urls import path
from .views import (
    StaffListView,
    StaffUpdateView,
    StaffDeleteView,
    StoreListCreateView,
    StoreRetrieveUpdateDestroyView,
    get_staff_stores,
)
from rest_framework_simplejwt.views import TokenRefreshView
from . import views 
from .views import get_my_store
from .views import update_profile, change_password
from .views import AdminRegistrationView, CheckAdminExistsView


urlpatterns = [
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('stores/', StoreListCreateView.as_view(), name='store-list'),
    path('admin-register/', AdminRegistrationView.as_view(), name='admin-register'),
    path('check-admin/', CheckAdminExistsView.as_view(), name='check-admin'),
    path('stores/<int:pk>/', StoreRetrieveUpdateDestroyView.as_view(), name='store-retrieve-update-destroy'),
    path('register/admin/', views.AdminRegistrationView.as_view(), name='admin-register'),
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('check-admin/', views.CheckAdminExistsView.as_view(), name='check-admin'),
    path('profile/', views.UserProfileView.as_view(), name='profile'),
    path('profile/update/', update_profile, name='profile-update'),
    path('profile/get/', views.get_user_profile, name='get-profile'),
    path('change-password/', change_password, name='change-password'),
    path('staff/', views.StaffListView.as_view(), name='staff-list'),
    path('staff/<int:pk>/', StaffUpdateView.as_view(), name='staff-update'),
    path('staff/<int:pk>/delete/', StaffDeleteView.as_view(), name='staff-delete'),
    path('staff-stores/', get_staff_stores, name='staff-stores'),
    path('my-store/', get_my_store, name='my-store'),
]