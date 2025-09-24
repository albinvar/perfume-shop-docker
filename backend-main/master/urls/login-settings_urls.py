# master/urls/login-settings_urls.py
from django.urls import path
from master.views import LoginSettingsRetrieveUpdateView

urlpatterns = [
    path('', LoginSettingsRetrieveUpdateView.as_view(), name='login-settings'),
]