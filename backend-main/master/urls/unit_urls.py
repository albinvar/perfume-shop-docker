from django.urls import path
from master.views import (
    UnitListCreateView,
    UnitRetrieveUpdateDestroyView
)

urlpatterns = [
    path('', UnitListCreateView.as_view(), name='unit-list'),
    path('<int:pk>/', UnitRetrieveUpdateDestroyView.as_view(), name='unit-detail'),
]