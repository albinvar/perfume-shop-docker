from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Max, Q
from django.db import models
from .models import Purchase
from .serializers import PurchaseSerializer, PurchaseReturnSerializer
from datetime import datetime

class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all().order_by('-date', '-created_at')
    serializer_class = PurchaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Filter by store if user has a store
        if hasattr(self.request.user, 'store') and self.request.user.store:
            queryset = queryset.filter(store=self.request.user.store)
        
        # Filter by supplier if supplier_id is provided
        supplier_id = self.request.query_params.get('supplier_id')
        if supplier_id:
            queryset = queryset.filter(supplier_id=supplier_id)
        
        # Filter by date range if provided
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date__gte=start_date)
            except ValueError:
                pass
                
        if end_date:
            try:
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
                queryset = queryset.filter(date__lte=end_date)
            except ValueError:
                pass
            
        # Filter by return status if provided
        is_return = self.request.query_params.get('is_return')
        if is_return in ['true', 'false']:
            queryset = queryset.filter(is_return=(is_return == 'true'))
            
        # Filter by status if provided
        status_param = self.request.query_params.get('status')
        if status_param in ['draft', 'completed', 'returned']:
            queryset = queryset.filter(status=status_param)
            
        return queryset.prefetch_related('items', 'items__product', 'return_reference')

    def perform_create(self, serializer):
        if not hasattr(self.request.user, 'store') or not self.request.user.store:
            return Response(
                {'store': 'User must be assigned to a store'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if 'created_by' in serializer.validated_data:
            del serializer.validated_data['created_by']
        
        serializer.save(store=self.request.user.store, created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        with transaction.atomic():
            # Revert product stock for all items
            for item in instance.items.all():
                if instance.is_return:
                    item.product.stock += item.quantity
                    # Also update the original purchase's returned quantity
                    if instance.return_reference:
                        original_item = instance.return_reference.items.filter(
                            product=item.product
                        ).first()
                        if original_item:
                            original_item.returned_quantity -= item.quantity
                            original_item.save()
                else:
                    item.product.stock -= item.quantity
                item.product.save()
            
            instance.items.all().delete()
            instance.delete()

    @action(detail=False, methods=['get'])
    def next_invoice_number(self, request):
        if not request.user.store:
            return Response(
                {'error': 'User must be assigned to a store'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_return = request.query_params.get('is_return', 'false') == 'true'
        max_invoice = Purchase.objects.filter(
            store=request.user.store,
            is_return=is_return
        ).aggregate(Max('invoice_no'))['invoice_no__max']
        
        if max_invoice:
            try:
                prefix = "PR" if is_return else "PE"
                last_num = int(max_invoice.replace(prefix, ''))
                next_num = last_num + 1
            except ValueError:
                next_num = 1
        else:
            next_num = 1
            
        next_number = f"{'PR' if is_return else 'PE'}{str(next_num).zfill(3)}"
        return Response({'invoice_no': next_number})

    @action(detail=False, methods=['get'])
    def returnable_purchases(self, request):
        """List purchases that can be returned (have items with remaining quantity)"""
        if not request.user.store:
            return Response(
                {'error': 'User must be assigned to a store'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        purchases = Purchase.objects.filter(
            store=request.user.store,
            is_return=False,
            items__returned_quantity__lt=models.F('items__quantity')
        ).distinct().prefetch_related('items', 'supplier')
        
        serializer = self.get_serializer(purchases, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def returnable_items(self, request, pk=None):
        """List items from a purchase that can be returned"""
        purchase = self.get_object()
        if purchase.is_return:
            return Response(
                {'error': 'Cannot return a return purchase'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        returnable_items = []
        for item in purchase.items.all():
            if item.quantity > item.returned_quantity:
                returnable_items.append({
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'product_code': item.product.product_code,
                    'original_quantity': item.quantity,
                    'returned_quantity': item.returned_quantity,
                    'remaining_quantity': item.quantity - item.returned_quantity,
                    'rate': item.rate,
                    'tax_type': item.tax_type,
                    'tax1_rate': item.tax1_rate,
                    'tax2_rate': item.tax2_rate
                })
                
        return Response(returnable_items)

    @action(detail=False, methods=['post'])
    def create_return(self, request):
        """Create a purchase return"""
        serializer = PurchaseReturnSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)