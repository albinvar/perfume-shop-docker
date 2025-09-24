from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from .models import Report
from .serializers import ReportSerializer, ReportGeneratorSerializer
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.http import HttpResponseRedirect
from django.db.models import Sum
from purchases.models import Purchase
from Sales.models import Sale
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['report_type', 'store', 'created_by', 'start_date', 'end_date']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        
        if user.role == 'STAFF':
            queryset = queryset.filter(created_by=user)
        
        return queryset.select_related('store', 'created_by')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['post'])
    def generate(self, request):
        serializer = ReportGeneratorSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            report = serializer.generate_report(request.user)
            return Response(
                ReportSerializer(report, context={'request': request}).data, 
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            logger.error(f"Error generating report: {str(e)}", exc_info=True)
            return Response(
                {'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        try:
            report = get_object_or_404(Report, pk=pk)
            
            if request.user.role == 'STAFF' and report.created_by != request.user:
                return Response(
                    {'detail': 'You do not have permission to access this report.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if not report.file_url:
                return Response(
                    {'detail': 'Report file not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return HttpResponseRedirect(report.file_url)
            
        except Exception as e:
            logger.error(f"Error downloading report: {str(e)}", exc_info=True)
            return Response(
                {'detail': 'Failed to download report.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def summary(self, request):
        try:
            store_id = request.query_params.get('store')
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            if not start_date or not end_date:
                return Response(
                    {'detail': 'Both start_date and end_date are required.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            purchase_qs = Purchase.objects.filter(date__range=[start_date, end_date], is_return=False)
            purchase_return_qs = Purchase.objects.filter(date__range=[start_date, end_date], is_return=True)
            sale_qs = Sale.objects.filter(date__range=[start_date, end_date], is_return=False)
            sale_return_qs = Sale.objects.filter(date__range=[start_date, end_date], is_return=True)
            
            if store_id:
                purchase_qs = purchase_qs.filter(store_id=store_id)
                purchase_return_qs = purchase_return_qs.filter(store_id=store_id)
                sale_qs = sale_qs.filter(store_id=store_id)
                sale_return_qs = sale_return_qs.filter(store_id=store_id)
            elif request.user.role == 'STAFF' and request.user.store:
                purchase_qs = purchase_qs.filter(store=request.user.store)
                purchase_return_qs = purchase_return_qs.filter(store=request.user.store)
                sale_qs = sale_qs.filter(store=request.user.store)
                sale_return_qs = sale_return_qs.filter(store=request.user.store)
            
            gross_purchase = purchase_qs.aggregate(total=Sum('total_amount'))['total'] or 0
            purchase_return = purchase_return_qs.aggregate(total=Sum('total_amount'))['total'] or 0
            gross_sale = sale_qs.aggregate(total=Sum('final_amount'))['total'] or 0
            sale_return = sale_return_qs.aggregate(total=Sum('final_amount'))['total'] or 0
            
            # Calculate net amounts
            net_purchase = gross_purchase - purchase_return
            net_sale = gross_sale - sale_return
            
            # Calculate totals according to requirements
            purchase_total_amount = net_purchase
            sales_total_amount = gross_sale 
            net_total = sales_total_amount-purchase_total_amount 
            
            return Response({
                'gross_purchase': float(gross_purchase),
                'purchase_return': float(purchase_return),
                'net_purchase': float(net_purchase),
                'gross_sale': float(gross_sale),
                'sale_return': float(sale_return),
                'net_sale': float(net_sale),
                'purchase_total_amount': float(purchase_total_amount),
                'sales_total_amount': float(sales_total_amount),
                'purchase_count': purchase_qs.count(),
                'purchase_return_count': purchase_return_qs.count(),
                'sale_count': sale_qs.count(),
                'sale_return_count': sale_return_qs.count(),
                'net_total': float(net_total),
                'store_id': store_id,
                'start_date': start_date,
                'end_date': end_date
            })
        except Exception as e:
            logger.error(f"Error in summary: {str(e)}", exc_info=True)
            return Response(
                {'detail': 'Failed to generate summary.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )