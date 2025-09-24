from django.db import models
from django.contrib.auth import get_user_model
from accounts.models import Store
from datetime import datetime
from django.conf import settings

User = get_user_model()

class Report(models.Model):
    REPORT_TYPES = (
        ('PURCHASE', 'Purchase Report'),
        ('PURCHASE_RETURN', 'Purchase Return Report'),
        ('SALE', 'Sale Report'),
        ('SALE_RETURN', 'Sale Return Report'),
    )
    
    FORMATS = (
        ('PDF', 'PDF'),
        ('DOCX', 'Word Document'),
        ('XLSX', 'Excel Spreadsheet'),
    )
    
    report_type = models.CharField(max_length=20, choices=REPORT_TYPES)
    format = models.CharField(max_length=10, choices=FORMATS)
    start_date = models.DateField()
    end_date = models.DateField()
    store = models.ForeignKey(Store, on_delete=models.SET_NULL, null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    file_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return f"{self.get_report_type_display()} ({self.start_date} to {self.end_date})"