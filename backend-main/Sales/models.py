from django.db import models
from django.contrib.auth import get_user_model
from products.models import Product
from accounts.models import Store
from customers_privilege.models import Customers
from django.core.exceptions import ValidationError
from django.utils import timezone

User = get_user_model()

PAYMENT_METHODS = (
    ('CASH', 'Cash'),
    ('ONLINE', 'Online Payment'),
    ('CHEQUE', 'Cheque'),
    ('CREDIT', 'Credit'),
)

class Sale(models.Model):
    invoice_no = models.CharField(max_length=20, unique=True)
    date = models.DateField()
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='sales')
    customer = models.ForeignKey(Customers, on_delete=models.PROTECT, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    final_amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='CASH')
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_sales')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='updated_sales')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_return = models.BooleanField(default=False)
    original_sale = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"Sale #{self.invoice_no}"

    def save(self, *args, **kwargs):
        if not self.invoice_no:
            # Generate invoice number like SA001, SA002, etc.
            last_sale = Sale.objects.order_by('-id').first()
            if last_sale:
                # Extract numeric part from invoice_no
                try:
                    last_num = int(''.join(filter(str.isdigit, last_sale.invoice_no)))
                except (ValueError, AttributeError):
                    last_num = 0
            else:
                last_num = 0
                
            prefix = 'RT' if self.is_return else 'SA'
            self.invoice_no = f"{prefix}{str(last_num + 1).zfill(3)}"
        super().save(*args, **kwargs)

    def return_sale(self):
        """Create a return sale for this sale"""
        if self.is_return:
            raise ValidationError("This is already a return sale")
        
        if Sale.objects.filter(original_sale=self).exists():
            raise ValidationError("Return already exists for this sale")
        
        # Create return sale with negative amounts
        return_sale = Sale.objects.create(
            invoice_no=f"RT{self.invoice_no}",
            date=timezone.now().date(),
            store=self.store,
            customer=self.customer,
            total_amount=-self.total_amount,
            discount_amount=-self.discount_amount,
            tax_amount=-self.tax_amount,
            final_amount=-self.final_amount,
            payment_method=self.payment_method,
            notes=f"Return for {self.invoice_no}",
            created_by=self.created_by,
            is_return=True,
            original_sale=self
        )
        
        # Create return items
        for item in self.items.all():
            SaleItem.objects.create(
                sale=return_sale,
                product=item.product,
                quantity=-item.quantity,
                rate=item.rate,
                discount=item.discount,
                tax1_rate=item.tax1_rate,
                tax2_rate=item.tax2_rate,
                tax_type=item.tax_type,
                amount=-item.amount
            )
            
        return return_sale

class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    discount = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax1_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax2_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_type = models.CharField(max_length=10, choices=Product.TAX_TYPES, default='INCLUSIVE')
    amount = models.DecimalField(max_digits=20, decimal_places=4, default=0)

    def save(self, *args, **kwargs):
        # Calculate amount based on quantity and rate
        self.amount = self.quantity * self.rate
        super().save(*args, **kwargs)