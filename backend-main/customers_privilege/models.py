from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models import Max
from django.contrib.auth import get_user_model

User = get_user_model()

class PrivilegeCard(models.Model):
    CARD_TYPES = (
        ('PREMIUM', 'Premium'),
        ('STANDARD', 'Standard'),
        ('BASIC', 'Basic'),
    )
    
    card_type = models.CharField(max_length=20, choices=CARD_TYPES, unique=True)
    discount_percentage = models.PositiveIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text="Discount percentage for this card type"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_card_type_display()} ({self.discount_percentage}%)"

class Customers(models.Model):
    customer_id = models.CharField(max_length=10, unique=True, editable=False)
    name = models.CharField(max_length=100)
    address = models.TextField()
    place = models.CharField(max_length=100)
    pin_code = models.CharField(max_length=10)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=15, unique=True)
    privilege_card = models.ForeignKey(
        PrivilegeCard,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='customers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_customers'
    )

    def __str__(self):
        return f"{self.name} ({self.customer_id})"

    def save(self, *args, **kwargs):
        if not self.customer_id:
            # Generate customer ID in format CIN001, CIN002, etc.
            last_customer = Customers.objects.aggregate(max_id=Max('id'))['max_id'] or 0
            self.customer_id = f"CIN{str(last_customer + 1).zfill(3)}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-created_at']
        