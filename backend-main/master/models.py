from django.db import models
from django.contrib.auth import get_user_model
from cloudinary.models import CloudinaryField
import uuid

User = get_user_model()

class Category(models.Model):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, related_name='categories_created', on_delete=models.SET_NULL, null=True, blank=True)
    updated_by = models.ForeignKey(User, related_name='categories_updated', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name

class Tax(models.Model):
    name = models.CharField(max_length=50)
    rate = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, related_name='taxes_created', on_delete=models.SET_NULL, null=True, blank=True)
    updated_by = models.ForeignKey(User, related_name='taxes_updated', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.rate}%)"

class Printer(models.Model):
    name = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    ip_address = models.CharField(max_length=50)
    port = models.CharField(max_length=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, related_name='printers_created', on_delete=models.SET_NULL, null=True, blank=True)
    updated_by = models.ForeignKey(User, related_name='printers_updated', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.name

class Unit(models.Model):
    UNIT_TYPES = (
        ('SALE', 'Sale Unit'),
        ('PURCHASE', 'Purchase Unit'),
    )
    name = models.CharField(max_length=50)
    type = models.CharField(max_length=10, choices=UNIT_TYPES)
    symbol = models.CharField(max_length=5)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, related_name='units_created', on_delete=models.SET_NULL, null=True, blank=True)
    updated_by = models.ForeignKey(User, related_name='units_updated', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"

class LoginSettings(models.Model):
    logo = CloudinaryField(
        'login_settings_logos',
        blank=True,
        null=True
    )
    company_name = models.CharField(max_length=100, default="TRUE BIT")
    first_part_text = models.CharField(max_length=50, default="TRUE")
    second_part_text = models.CharField(max_length=50, default="BIT")
    first_part_color = models.CharField(max_length=20, default="#FFFFFF")
    second_part_color = models.CharField(max_length=20, default="#FF6B6B")
    subtitle = models.CharField(max_length=200, default="TECHNOLOGIES & INVENTIONS PVT.LTD")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, related_name='login_settings_created', on_delete=models.SET_NULL, null=True, blank=True)
    updated_by = models.ForeignKey(User, related_name='login_settings_updated', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        verbose_name = "Login Page Settings"
        verbose_name_plural = "Login Page Settings"

    def __str__(self):
        return "Login Page Settings"

    def get_logo_url(self):
        if self.logo:
            return self.logo.url
        return None