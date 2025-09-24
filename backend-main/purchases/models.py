from django.db import models
from django.contrib.auth import get_user_model
from products.models import Product
from supplier.models import Supplier
from accounts.models import Store
from django.db.models import Max

User = get_user_model()

class Purchase(models.Model):
    PAYMENT_TYPES = [
        ('credit', 'Credit'),
        ('cash', 'Cash'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('completed', 'Completed'),
        ('returned', 'Returned'),
    ]

    invoice_no = models.CharField(max_length=50, unique=True)
    date = models.DateField()
    payment_type = models.CharField(max_length=10, choices=PAYMENT_TYPES, default='cash')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='completed')
    supplier_invoice_no = models.CharField(max_length=50, blank=True, null=True)
    supplier_invoice_date = models.DateField(blank=True, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='purchases')
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name='purchases')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    remarks = models.TextField(blank=True, null=True)
    is_return = models.BooleanField(default=False)
    return_reference = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='returns')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_purchases')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='updated_purchases')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Purchase'
        verbose_name_plural = 'Purchases'

    def __str__(self):
        prefix = "PR" if self.is_return else "PE"
        return f"{prefix}#{self.invoice_no} - {self.supplier.name}"

    def save(self, *args, **kwargs):
        if not self.invoice_no:
            prefix = "PR" if self.is_return else "PE"
            max_invoice = Purchase.objects.filter(
                store=self.store,
                is_return=self.is_return
            ).aggregate(Max('invoice_no'))['invoice_no__max']
            
            if max_invoice:
                try:
                    last_num = int(max_invoice.replace(prefix, ''))
                    new_num = last_num + 1
                except ValueError:
                    new_num = 1
            else:
                new_num = 1
                
            self.invoice_no = f"{prefix}{str(new_num).zfill(3)}"
        
        # If this is a return, mark the original purchase as returned
        if self.is_return and self.return_reference and self.return_reference.status != 'returned':
            self.return_reference.status = 'returned'
            self.return_reference.save()
            
        super().save(*args, **kwargs)


class PurchaseItem(models.Model):
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    tax1_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax2_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_type = models.CharField(max_length=10, default='INCLUSIVE')
    returned_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        verbose_name = 'Purchase Item'
        verbose_name_plural = 'Purchase Items'

    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.rate
        if self.tax_type == 'EXCLUSIVE':
            tax1 = (self.amount * self.tax1_rate) / 100
            tax2 = (self.amount * self.tax2_rate) / 100
            self.tax_amount = tax1 + tax2
            self.amount += self.tax_amount
        
        # Update product stock based on whether this is a return or not
        if not self.pk:
            if self.purchase.is_return:
                self.product.stock -= self.quantity
            else:
                self.product.stock += self.quantity
            self.product.save()
        
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Adjust product stock when item is deleted
        if self.purchase.is_return:
            self.product.stock += self.quantity
        else:
            self.product.stock -= self.quantity
        self.product.save()
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"