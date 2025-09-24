from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Supplier(models.Model):
    PAYMENT_MODES = [
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
        ('online', 'Online Transfer'),
        ('upi', 'UPI'),
        ('other', 'Other'),
    ]
    
    name = models.CharField(max_length=100)
    address = models.TextField()
    city = models.CharField(max_length=100)
    contact_no = models.CharField(max_length=15)
    contact_email = models.EmailField(blank=True, null=True)
    gstin = models.CharField(max_length=15, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    account_number = models.CharField(max_length=20, blank=True, null=True)
    ifsc_code = models.CharField(max_length=20, blank=True, null=True)
    opening_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    current_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_suppliers')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='updated_suppliers')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def update_balance(self):
        transactions = self.transactions.all()
        total_debit = sum(t.debit for t in transactions)
        total_credit = sum(t.credit for t in transactions)
        self.current_balance = self.opening_balance + total_debit - total_credit
        self.save()

class SupplierTransaction(models.Model):
    PAYMENT_MODES = [
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
        ('online', 'Online Transfer'),
        ('upi', 'UPI'),
        ('other', 'Other'),
    ]
    
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='transactions')
    transaction_no = models.CharField(max_length=20, unique=True)
    transaction_date = models.DateField(default=timezone.now)
    invoice_no = models.CharField(max_length=50, blank=True, null=True)
    particulars = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    debit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    credit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payment_mode = models.CharField(max_length=20, choices=PAYMENT_MODES)
    remarks = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-transaction_date', '-id']

    def save(self, *args, **kwargs):
        if not self.transaction_no:
            last_trans = SupplierTransaction.objects.order_by('-id').first()
            last_id = last_trans.id if last_trans else 0
            self.transaction_no = f"ST{str(last_id + 1).zfill(4)}"
        
        super().save(*args, **kwargs)
        self.supplier.update_balance()

    def delete(self, *args, **kwargs):
        supplier = self.supplier
        super().delete(*args, **kwargs)
        supplier.update_balance()

    def __str__(self):
        return f"{self.transaction_no} - {self.supplier.name}"