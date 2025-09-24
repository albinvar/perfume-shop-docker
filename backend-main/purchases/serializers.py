from rest_framework import serializers
from .models import Purchase, PurchaseItem
from products.models import Product
from supplier.models import Supplier
from decimal import Decimal
from django.db import transaction

class PurchaseItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True,
        required=True
    )
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    product_purchase_rate = serializers.DecimalField(
        source='product.purchase_rate', 
        read_only=True,
        max_digits=10,
        decimal_places=2
    )
    product_tax_type = serializers.CharField(source='product.tax_type', read_only=True)
    product_tax1_name = serializers.SerializerMethodField()
    product_tax1_rate = serializers.SerializerMethodField()
    product_tax2_name = serializers.SerializerMethodField()
    product_tax2_rate = serializers.SerializerMethodField()
    product_hsn_code = serializers.CharField(source='product.hsn_code', read_only=True)
    product_barcode = serializers.CharField(source='product.barcode', read_only=True)
    product_stock = serializers.DecimalField(source='product.stock', read_only=True, max_digits=10, decimal_places=2)
    can_return = serializers.SerializerMethodField()
    remaining_qty = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseItem
        fields = [
            'id', 'product_id', 'product_name', 'product_code',
            'quantity', 'rate', 'amount', 'tax_amount',
            'product_purchase_rate', 'product_tax_type',
            'product_tax1_name', 'product_tax1_rate',
            'product_tax2_name', 'product_tax2_rate',
            'product_hsn_code', 'product_barcode',
            'product_stock', 'returned_quantity',
            'can_return', 'remaining_qty'
        ]
        read_only_fields = ['amount', 'tax_amount', 'returned_quantity']
        extra_kwargs = {
            'quantity': {'required': True, 'min_value': 0.01},
            'rate': {'required': True, 'min_value': 0.01}
        }

    def get_product_tax1_name(self, obj):
        return obj.product.tax1.name if obj.product.tax1 else None

    def get_product_tax1_rate(self, obj):
        return obj.product.tax1.rate if obj.product.tax1 else 0

    def get_product_tax2_name(self, obj):
        return obj.product.tax2.name if obj.product.tax2 else None

    def get_product_tax2_rate(self, obj):
        return obj.product.tax2.rate if obj.product.tax2 else 0
        
    def get_can_return(self, obj):
        return obj.quantity > obj.returned_quantity
        
    def get_remaining_qty(self, obj):
        return obj.quantity - obj.returned_quantity

class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, required=True)
    supplier_id = serializers.PrimaryKeyRelatedField(
        queryset=Supplier.objects.all(),
        source='supplier',
        write_only=True,
        required=True
    )
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    supplier_gstin = serializers.CharField(source='supplier.gstin', read_only=True)
    supplier_contact = serializers.CharField(source='supplier.contact_no', read_only=True)
    supplier_address = serializers.CharField(source='supplier.address', read_only=True)
    store = serializers.PrimaryKeyRelatedField(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    can_return = serializers.SerializerMethodField()
    return_reference_invoice = serializers.CharField(source='return_reference.invoice_no', read_only=True)

    class Meta:
        model = Purchase
        fields = [
            'id', 'invoice_no', 'date', 'payment_type', 'supplier_id',
            'supplier_name', 'supplier_gstin', 'supplier_contact', 'supplier_address',
            'supplier_invoice_no', 'supplier_invoice_date', 'store', 'store_name', 
            'remarks', 'items', 'total_amount', 'created_at', 'updated_at',
            'created_by', 'created_by_username', 'is_return', 'return_reference',
            'return_reference_invoice', 'status', 'can_return'
        ]
        read_only_fields = [
            'invoice_no', 'total_amount', 'store', 
            'created_at', 'updated_at', 'created_by',
            'is_return', 'status'
        ]

    def get_can_return(self, obj):
        if obj.is_return:
            return False
        return any(item.quantity > item.returned_quantity for item in obj.items.all())

    def validate(self, data):
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'store') or not request.user.store:
            raise serializers.ValidationError({
                'store': 'User must be assigned to a store'
            })

        if not data.get('items') or len(data['items']) == 0:
            raise serializers.ValidationError({
                'items': 'At least one item is required'
            })

        # Validate date format if manually entered
        if 'date' in data and isinstance(data['date'], str):
            try:
                from datetime import datetime
                datetime.strptime(data['date'], '%Y-%m-%d')
            except ValueError:
                raise serializers.ValidationError({
                    'date': 'Date must be in YYYY-MM-DD format'
                })

        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        request = self.context.get('request')
        
        validated_data.pop('store', None)
        validated_data.pop('created_by', None)

        with transaction.atomic():
            purchase = Purchase.objects.create(
                store=request.user.store,
                created_by=request.user,
                **validated_data
            )

            total_amount = Decimal('0.00')

            for item_data in items_data:
                product = item_data['product']
                quantity = Decimal(str(item_data['quantity']))
                rate = Decimal(str(item_data.get('rate', product.purchase_rate)))
                amount = quantity * rate
                tax_amount = Decimal('0.00')
                tax1_rate = product.tax1.rate if product.tax1 else Decimal('0')
                tax2_rate = product.tax2.rate if product.tax2 else Decimal('0')

                if product.tax_type == 'EXCLUSIVE':
                    tax1 = (amount * tax1_rate) / Decimal('100')
                    tax2 = (amount * tax2_rate) / Decimal('100')
                    tax_amount = tax1 + tax2
                    amount += tax_amount

                PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    quantity=quantity,
                    rate=rate,
                    amount=amount,
                    tax_amount=tax_amount,
                    tax1_rate=tax1_rate,
                    tax2_rate=tax2_rate,
                    tax_type=product.tax_type
                )

                product.stock += quantity
                product.save()

                total_amount += amount

            purchase.total_amount = total_amount
            purchase.save()

        return purchase

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', [])
        request = self.context.get('request')
        
        with transaction.atomic():
            # First, revert stock for all existing items
            for item in instance.items.all():
                if instance.is_return:
                    item.product.stock += item.quantity
                else:
                    item.product.stock -= item.quantity
                item.product.save()

            validated_data.pop('created_by', None)
            validated_data.pop('updated_by', None)

            instance.date = validated_data.get('date', instance.date)
            instance.payment_type = validated_data.get('payment_type', instance.payment_type)
            instance.supplier = validated_data.get('supplier', instance.supplier)
            instance.supplier_invoice_no = validated_data.get('supplier_invoice_no', instance.supplier_invoice_no)
            instance.supplier_invoice_date = validated_data.get('supplier_invoice_date', instance.supplier_invoice_date)
            instance.remarks = validated_data.get('remarks', instance.remarks)
            instance.updated_by = request.user

            instance.items.all().delete()

            total_amount = Decimal('0.00')
            
            for item_data in items_data:
                product = item_data['product']
                quantity = Decimal(str(item_data['quantity']))
                rate = Decimal(str(item_data.get('rate', product.purchase_rate)))
                amount = quantity * rate
                tax_amount = Decimal('0.00')
                tax1_rate = product.tax1.rate if product.tax1 else Decimal('0')
                tax2_rate = product.tax2.rate if product.tax2 else Decimal('0')

                if product.tax_type == 'EXCLUSIVE':
                    tax1 = (amount * tax1_rate) / Decimal('100')
                    tax2 = (amount * tax2_rate) / Decimal('100')
                    tax_amount = tax1 + tax2
                    amount += tax_amount

                PurchaseItem.objects.create(
                    purchase=instance,
                    product=product,
                    quantity=quantity,
                    rate=rate,
                    amount=amount,
                    tax_amount=tax_amount,
                    tax1_rate=tax1_rate,
                    tax2_rate=tax2_rate,
                    tax_type=product.tax_type
                )

                if instance.is_return:
                    product.stock -= quantity
                else:
                    product.stock += quantity
                product.save()

                total_amount += amount

            instance.total_amount = total_amount
            instance.save()

        return instance

class PurchaseReturnSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(many=True, required=True)
    return_reference_id = serializers.PrimaryKeyRelatedField(
        queryset=Purchase.objects.filter(is_return=False),
        source='return_reference',
        write_only=True,
        required=True
    )
    supplier_id = serializers.PrimaryKeyRelatedField(
        source='supplier',
        read_only=True
    )
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    store = serializers.PrimaryKeyRelatedField(read_only=True)
    store_name = serializers.CharField(source='store.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Purchase
        fields = [
            'id', 'invoice_no', 'date', 'payment_type', 'supplier_id',
            'supplier_name', 'store', 'store_name', 'remarks', 'items',
            'total_amount', 'created_at', 'created_by', 'created_by_username',
            'return_reference_id'
        ]
        read_only_fields = [
            'invoice_no', 'total_amount', 'store', 'supplier',
            'created_at', 'created_by'
        ]

    def validate(self, data):
        request = self.context.get('request')
        if not request or not hasattr(request.user, 'store') or not request.user.store:
            raise serializers.ValidationError({
                'store': 'User must be assigned to a store'
            })

        if not data.get('items') or len(data['items']) == 0:
            raise serializers.ValidationError({
                'items': 'At least one item is required'
            })

        original_purchase = data['return_reference']
        if original_purchase.is_return:
            raise serializers.ValidationError({
                'return_reference': 'Cannot return a return purchase'
            })

        # Validate that return quantities don't exceed original quantities
        for item_data in data['items']:
            original_item = original_purchase.items.filter(product=item_data['product']).first()
            if not original_item:
                raise serializers.ValidationError({
                    'items': f"Product {item_data['product'].name} not found in original purchase"
                })
            
            remaining_qty = original_item.quantity - original_item.returned_quantity
            if item_data['quantity'] > remaining_qty:
                raise serializers.ValidationError({
                    'items': f"Cannot return more than {remaining_qty} of {item_data['product'].name}"
                })

        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        return_reference = validated_data.pop('return_reference')
        request = self.context.get('request')
        
        validated_data['supplier'] = return_reference.supplier
        validated_data['store'] = request.user.store
        validated_data['created_by'] = request.user
        validated_data['is_return'] = True

        with transaction.atomic():
            purchase = Purchase.objects.create(
                return_reference=return_reference,
                **validated_data
            )

            total_amount = Decimal('0.00')

            for item_data in items_data:
                product = item_data['product']
                quantity = Decimal(str(item_data['quantity']))
                rate = Decimal(str(item_data.get('rate', product.purchase_rate)))
                amount = quantity * rate
                tax_amount = Decimal('0.00')
                tax1_rate = product.tax1.rate if product.tax1 else Decimal('0')
                tax2_rate = product.tax2.rate if product.tax2 else Decimal('0')

                if product.tax_type == 'EXCLUSIVE':
                    tax1 = (amount * tax1_rate) / Decimal('100')
                    tax2 = (amount * tax2_rate) / Decimal('100')
                    tax_amount = tax1 + tax2
                    amount += tax_amount

                PurchaseItem.objects.create(
                    purchase=purchase,
                    product=product,
                    quantity=quantity,
                    rate=rate,
                    amount=amount,
                    tax_amount=tax_amount,
                    tax1_rate=tax1_rate,
                    tax2_rate=tax2_rate,
                    tax_type=product.tax_type
                )

                # Update product stock (decrease for returns)
                product.stock -= quantity
                product.save()

                # Update returned quantity in original purchase
                original_item = return_reference.items.filter(product=product).first()
                if original_item:
                    original_item.returned_quantity += quantity
                    original_item.save()

                total_amount += amount

            purchase.total_amount = total_amount
            purchase.save()

            # Update original purchase status if fully returned
            if all(item.quantity == item.returned_quantity for item in return_reference.items.all()):
                return_reference.status = 'returned'
                return_reference.save()

        return purchase