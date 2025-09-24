from django.urls import path
from master.views import (
    TaxListCreateView,
    TaxRetrieveUpdateDestroyView
)

urlpatterns = [
    path('', TaxListCreateView.as_view(), name='tax-list'),
    path('<int:pk>/', TaxRetrieveUpdateDestroyView.as_view(), name='tax-detail'),
]