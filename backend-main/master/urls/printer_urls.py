from django.urls import path
from master.views import (
    PrinterListCreateView,
    PrinterRetrieveUpdateDestroyView
)

urlpatterns = [
    path('', PrinterListCreateView.as_view(), name='printer-list'),
    path('<int:pk>/', PrinterRetrieveUpdateDestroyView.as_view(), name='printer-detail'),
]