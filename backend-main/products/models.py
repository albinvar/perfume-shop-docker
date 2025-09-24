from django.db import models
from django.core.validators import MinValueValidator, FileExtensionValidator
from django.contrib.auth import get_user_model
from accounts.models import Store
from cloudinary.models import CloudinaryField

User = get_user_model()

class Product(models.Model):
    TAX_TYPES = (
        ('INCLUSIVE', 'Inclusive'),
        ('EXCLUSIVE', 'Exclusive'),
    )
    
    product_code = models.CharField(max_length=50, unique=True, blank=True)
    name = models.CharField(max_length=100)
    hsn_code = models.CharField(max_length=10, blank=True, null=True)
    store = models.ForeignKey(
        Store, 
        on_delete=models.PROTECT, 
        related_name='products', 
        null=True, 
        blank=True,
        help_text="Leave blank for global products (admin only)"
    )
    category = models.ForeignKey('master.Category', on_delete=models.SET_NULL, null=True, blank=True)
    stock = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True, null=True)
    mrp = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)],
        help_text="Maximum Retail Price"
    )
    discount = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        default=0,
        validators=[MinValueValidator(0)]
    )
    purchase_rate = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)], 
        blank=True, 
        null=True
    )
    sale_rate = models.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        validators=[MinValueValidator(0)], 
        blank=True, 
        null=True
    )
    tax1 = models.ForeignKey(
        'master.Tax', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='primary_tax_products'
    )
    tax2 = models.ForeignKey(
        'master.Tax', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='secondary_tax_products'
    )
    tax_type = models.CharField(max_length=10, choices=TAX_TYPES, default='INCLUSIVE')
    opening_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    barcode = models.CharField(max_length=100, unique=True, blank=True, null=True)
    unit = models.ForeignKey('master.Unit', on_delete=models.SET_NULL, null=True, blank=True)
    image = CloudinaryField(
        'products',
        null=True,
        blank=True,
        validators=[FileExtensionValidator(allowed_extensions=[
            'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp'
        ])]
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, 
        related_name='products_created', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    updated_by = models.ForeignKey(
        User, 
        related_name='products_updated', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Product'
        verbose_name_plural = 'Products'

    def __str__(self):
        return f"{self.name} ({self.product_code})"

    @property
    def calculated_price(self):
        """Calculate final price after discount and taxes"""
        price = float(self.mrp)
        
        # Apply discount if any
        if self.discount:
            price -= float(self.discount)
        
        # Calculate taxes if tax type is exclusive
        if self.tax_type == 'EXCLUSIVE':
            tax_amount = 0
            if self.tax1:
                tax_amount += (price * float(self.tax1.rate)) / 100
            if self.tax2:
                tax_amount += (price * float(self.tax2.rate)) / 100
            price += tax_amount
        
        return round(price, 2)

    def is_in_use(self):
        from purchases.models import PurchaseItem
        from Sales.models import SaleItem
        return (
            PurchaseItem.objects.filter(product=self).exists() or
            SaleItem.objects.filter(product=self).exists()
        )

    def save(self, *args, **kwargs):
        # Generate product code if empty
        if not self.product_code:
            prefix = "0"
            last_product = Product.objects.order_by('-id').first()
            if last_product and last_product.product_code:
                try:
                    last_num = int(last_product.product_code.split('-')[-1])
                    new_num = last_num + 1
                except (ValueError, IndexError):
                    new_num = 1
            else:
                new_num = 1
            self.product_code = f"{prefix}-{str(new_num).zfill(4)}"

        # Generate barcode if empty
        if not self.barcode:
            clean_name = ''.join(c for c in self.name.upper() if c.isalnum())[:5]
            self.barcode = f"COMP-{self.product_code}-{clean_name}"

        super().save(*args, **kwargs)