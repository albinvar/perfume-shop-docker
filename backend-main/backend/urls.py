"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# backend/urls.py
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from accounts.views import CheckAdminExistsView, AdminRegistrationView

from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import CustomTokenObtainPairView, UserRegistrationView, UserProfileView
from django.contrib import admin
from accounts.views import (
    CustomTokenObtainPairView,
    UserRegistrationView,
    UserProfileView,
    StoreListCreateView,
    StoreRetrieveUpdateDestroyView
)
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.views import CustomTokenObtainPairView, UserRegistrationView, UserProfileView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/check-admin-exists/', CheckAdminExistsView.as_view(), name='check-admin-exists'),
    path('api/admin-register/', AdminRegistrationView.as_view(), name='admin-register'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/', UserRegistrationView.as_view(), name='register'),
    path('api/profile/', UserProfileView.as_view(), name='profile'),
    path('api/accounts/', include('accounts.urls')),
    path('api/purchases/', include('purchases.urls')),

    path('api/customers-privilege/', include('customers_privilege.urls')),
    # Make sure these are included exactly like this:
    path('api/products/', include('products.urls')),
    path('api/categories/', include('products.urls')),  # If you want categories at this path
    
    path('api/purchases/', include('purchases.urls')),
    path('api/Sales/', include('Sales.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/stores/', StoreListCreateView.as_view(), name='store-list'),
    path('api/stores/<int:pk>/', StoreRetrieveUpdateDestroyView.as_view(), name='store-detail'),
        # Suppliers endpoints
    path('api/supplier/', include('supplier.urls')),
    # Master endpoints
    path('api/master/categories/', include('master.urls.category_urls')),
    path('api/master/login-settings/', include('master.urls.login-settings_urls')),
    path('api/master/taxes/', include('master.urls.tax_urls')),
    path('api/master/printers/', include('master.urls.printer_urls')),
    path('api/master/units/', include('master.urls.unit_urls')),
    path('api/reports/', include('reports.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/reports/', include('reports.urls')),
   
]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)