from rest_framework import viewsets, permissions, generics
from django.template.loader import render_to_string
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.http import HttpResponse
from django.template.loader import get_template
from xhtml2pdf import pisa
from datetime import datetime
from .models import Supplier, SupplierTransaction
from .serializers import SupplierSerializer, SupplierTransactionSerializer

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['name', 'city', 'gstin']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

class SupplierTransactionViewSet(viewsets.ModelViewSet):
    queryset = SupplierTransaction.objects.all()
    serializer_class = SupplierTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['supplier', 'payment_mode', 'transaction_date']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class SupplierReportView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            # Get query parameters with defaults
            supplier_id = request.query_params.get('supplier_id')
            start_date = request.query_params.get('start_date', datetime.now().date())
            end_date = request.query_params.get('end_date', datetime.now().date())
            
            # Initialize variables
            supplier = None
            transactions = SupplierTransaction.objects.none()
            totals = {
                'debit': 0,
                'credit': 0,
                'current_balance': 0
            }

            # Filter transactions if supplier_id provided
            if supplier_id:
                try:
                    supplier = Supplier.objects.get(id=supplier_id)
                    transactions = SupplierTransaction.objects.filter(supplier=supplier)
                    totals['current_balance'] = supplier.current_balance
                except Supplier.DoesNotExist:
                    return HttpResponse('Supplier not found', status=404)

            # Apply date filters
            transactions = transactions.filter(
                transaction_date__gte=start_date,
                transaction_date__lte=end_date
            ).order_by('transaction_date')

            # Calculate totals
            totals['debit'] = sum(t.debit for t in transactions)
            totals['credit'] = sum(t.credit for t in transactions)

            context = {
                'supplier': supplier,
                'transactions': transactions,
                'totals': totals,
                'today': datetime.now(),
                'filter': {
                    'start_date': start_date,
                    'end_date': end_date,
                },
                'request': request
            }

            # Render PDF
            html = render_to_string('supplier/supplier_report.html', context)
            response = HttpResponse(content_type='application/pdf')
            response['Content-Disposition'] = 'attachment; filename="supplier_report.pdf"'
            
            if pisa.CreatePDF(html, dest=response).err:
                return HttpResponse('Error generating PDF', status=500)
            
            return response

        except Exception as e:
            return HttpResponse(f'Server Error: {str(e)}', status=500)