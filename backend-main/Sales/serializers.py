from rest_framework import serializers
from .models import Sale, SaleItem
from products.models import Product
from customers_privilege.serializers import CustomerSerializer
from accounts.serializers import StoreSerializer
from django.contrib.auth import get_user_model
from django.conf import settings
from django.db import transaction
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class SaleItemSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True,
        required=True
    )
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.product_code', read_only=True)
    barcode = serializers.CharField(source='product.barcode', read_only=True)
    mrp = serializers.DecimalField(source='product.mrp', read_only=True, max_digits=10, decimal_places=2)
    category_name = serializers.CharField(source='product.category.name', read_only=True)
    hsn_code = serializers.CharField(source='product.hsn_code', read_only=True)
    tax1_name = serializers.CharField(source='product.tax1.name', read_only=True)
    tax2_name = serializers.CharField(source='product.tax2.name', read_only=True)
    tax1_percentage = serializers.DecimalField(source='product.tax1.rate', read_only=True, max_digits=5, decimal_places=2)
    tax2_percentage = serializers.DecimalField(source='product.tax2.rate', read_only=True, max_digits=5, decimal_places=2)
    tax_type = serializers.CharField(source='product.tax_type', read_only=True)

    class Meta:
        model = SaleItem
        fields = [
            'id', 'product_id', 'product_name', 'product_code', 'barcode',
            'category_name', 'hsn_code', 'mrp', 'quantity', 'rate', 'discount',
            'tax1_name', 'tax1_percentage', 'tax2_name', 'tax2_percentage',
            'tax_type', 'amount'
        ]
        read_only_fields = ['amount']

    def validate_quantity(self, value):
        if value == 0:
            raise serializers.ValidationError("Quantity cannot be zero")
        return value

    def validate_rate(self, value):
        if value <= 0:
            raise serializers.ValidationError("Rate must be greater than 0")
        return value

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, required=True)
    customer_details = CustomerSerializer(source='customer', read_only=True)
    store_details = StoreSerializer(source='store', read_only=True)
    staff_name = serializers.CharField(source='created_by.username', read_only=True)
    is_return = serializers.BooleanField(read_only=True)
    original_sale = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_no', 'date', 'store', 'store_details', 'customer',
            'customer_details', 'total_amount', 'discount_amount', 'tax_amount',
            'final_amount', 'payment_method', 'notes', 'items', 'created_at',
            'created_by', 'staff_name', 'is_return', 'original_sale'
        ]
        read_only_fields = [
            'invoice_no', 'total_amount', 'discount_amount', 'tax_amount',
            'final_amount', 'created_at', 'created_by', 'is_return', 'original_sale'
        ]

    def validate(self, data):
        if 'items' not in data or len(data['items']) == 0:
            raise serializers.ValidationError("At least one item is required")
        
        # Validate return sale constraints
        if self.instance and self.instance.is_return:
            raise serializers.ValidationError("Cannot modify a return sale")
            
        return data

    @transaction.atomic
    def create(self, validated_data):
        logger.info(f"Creating sale with data: {validated_data}")
        items_data = validated_data.pop('items')
        request = self.context.get('request')

        try:
            total_amount = sum(item['quantity'] * item['rate'] for item in items_data)

            customer = validated_data.get('customer')
            discount_amount = 0
            if customer and customer.privilege_card:
                discount_amount = total_amount * customer.privilege_card.discount_percentage / 100
                total_amount -= discount_amount

            tax_amount = 0
            for item in items_data:
                product = item['product']
                if product.tax_type == 'EXCLUSIVE':
                    if product.tax1:
                        tax_amount += (item['quantity'] * item['rate']) * product.tax1.rate / 100
                    if product.tax2:
                        tax_amount += (item['quantity'] * item['rate']) * product.tax2.rate / 100

            final_amount = total_amount + tax_amount

            validated_data.pop('created_by', None)

            sale = Sale.objects.create(
                **validated_data,
                total_amount=total_amount,
                discount_amount=discount_amount,
                tax_amount=tax_amount,
                final_amount=final_amount,
                created_by=request.user if request else None
            )

            sale_items = []
            for item_data in items_data:
                product = item_data['product']
                quantity = item_data['quantity']
                rate = item_data['rate']
                amount = quantity * rate

                sale_items.append(SaleItem(
                    sale=sale,
                    product=product,
                    quantity=quantity,
                    rate=rate,
                    discount=discount_amount,
                    tax1_rate=product.tax1.rate if product.tax1 else 0,
                    tax2_rate=product.tax2.rate if product.tax2 else 0,
                    tax_type=product.tax_type,
                    amount=amount
                ))

            
            SaleItem.objects.bulk_create(sale_items)

            if customer and customer.phone and all([
                    settings.TWILIO_ACCOUNT_SID,
                    settings.TWILIO_AUTH_TOKEN,
                    settings.TWILIO_PHONE_NUMBER
                ]):
                    try:
                        # Sanitize phone number
                        phone = customer.phone.strip()
                        if not phone.startswith('+'):
                            phone = '+91' + phone  # Replace '+91' with your default country code

                        from twilio.rest import Client
                        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

                        product_names = ", ".join([item['product'].name for item in items_data][:3])
                        if len(items_data) > 3:
                            product_names += f" and {len(items_data) - 3} more items"

                        client.messages.create(
                            body=f"Thank you for your purchase of {product_names}. Total amount: ₹{final_amount:.2f}. Please visit us again!",
                            from_=settings.TWILIO_PHONE_NUMBER,
                            to=phone
                        )
                    except Exception as e:
                        logger.error(f"Failed to send SMS: {str(e)}")

            return sale
        except Exception as e:
            logger.error(f"Error in sale creation: {str(e)}", exc_info=True)
            raise serializers.ValidationError(str(e))

    @transaction.atomic
    def update(self, instance, validated_data):
        try:
            items_data = validated_data.pop('items', [])
            request = self.context.get('request')

            instance.date = validated_data.get('date', instance.date)
            instance.customer = validated_data.get('customer', instance.customer)
            instance.payment_method = validated_data.get('payment_method', instance.payment_method)
            instance.notes = validated_data.get('notes', instance.notes)

            total_amount = sum(item['quantity'] * item['rate'] for item in items_data)

            discount_amount = 0
            if instance.customer and instance.customer.privilege_card:
                discount_amount = total_amount * instance.customer.privilege_card.discount_percentage / 100
                total_amount -= discount_amount

            tax_amount = 0
            for item in items_data:
                product = item['product']
                if product.tax_type == 'EXCLUSIVE':
                    if product.tax1:
                        tax_amount += (item['quantity'] * item['rate']) * product.tax1.rate / 100
                    if product.tax2:
                        tax_amount += (item['quantity'] * item['rate']) * product.tax2.rate / 100

            final_amount = total_amount + tax_amount

            instance.total_amount = total_amount
            instance.discount_amount = discount_amount
            instance.tax_amount = tax_amount
            instance.final_amount = final_amount

            if request and request.user:
                instance.updated_by = request.user

            instance.save()

            instance.items.all().delete()

            sale_items = []
            for item_data in items_data:
                product = item_data['product']
                quantity = item_data['quantity']
                rate = item_data['rate']
                amount = quantity * rate

                sale_items.append(SaleItem(
                    sale=instance,
                    product=product,
                    quantity=quantity,
                    rate=rate,
                    discount=discount_amount,
                    tax1_rate=product.tax1.rate if product.tax1 else 0,
                    tax2_rate=product.tax2.rate if product.tax2 else 0,
                    tax_type=product.tax_type,
                    amount=amount
                ))

            SaleItem.objects.bulk_create(sale_items)

            return instance
        except Exception as e:
            logger.error(f"Error in sale update: {str(e)}", exc_info=True)
            raise serializers.ValidationError(str(e))