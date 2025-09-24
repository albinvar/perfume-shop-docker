from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from cloudinary.models import CloudinaryField

class Store(models.Model):
    name = models.CharField(max_length=100)
    place = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=15)
    store_id = models.CharField(max_length=50, unique=True)
    photo = CloudinaryField(
        'store_photos',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png'])],
        blank=True,
        null=True,
        help_text="Upload store photo (jpg, jpeg, png only)"
    )
    gst_number = models.CharField(max_length=50, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def get_photo_url(self):
        if self.photo:
            return self.photo.url
        return None

    class Meta:
        ordering = ['-created_at']

class User(AbstractUser):
    ROLE_CHOICES = (
        ('ADMIN', 'Admin'),
        ('STAFF', 'Staff'),
    )
    
    phone = models.CharField(max_length=15, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    place = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STAFF')
    photo = CloudinaryField(
        'user_photos',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png'])],
        blank=True,
        null=True
    )
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)

    def save(self, *args, **kwargs):
        if self.role == 'ADMIN' and not self.pk:
            if User.objects.filter(role='ADMIN').exists():
                raise ValidationError("Only one admin user is allowed in the system.")
        
        if not self.role:
            self.role = 'STAFF'
        super().save(*args, **kwargs)

    def is_admin(self):
        return self.role == 'ADMIN'

    def get_photo_url(self):
        if self.photo:
            return self.photo.url
        return None

class Registration(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='registration')
    password = models.CharField(max_length=128)
    image = CloudinaryField(
        'registration_photos',
        validators=[FileExtensionValidator(['jpg', 'jpeg', 'png'])],
        blank=True,
        null=True
    )
    user_role = models.CharField(max_length=10, choices=User.ROLE_CHOICES)
    registered_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Registration for {self.user.username}"
    
    def get_image_url(self):
        if self.image:
            return self.image.url
        return None