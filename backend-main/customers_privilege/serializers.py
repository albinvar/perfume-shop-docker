from rest_framework import serializers
from .models import PrivilegeCard, Customers
from django.contrib.auth import get_user_model

User = get_user_model()

class PrivilegeCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivilegeCard
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at')

class CustomerSerializer(serializers.ModelSerializer):
    privilege_card_details = serializers.SerializerMethodField()
    created_by = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = Customers
        fields = '__all__'
        read_only_fields = ('customer_id', 'created_at', 'updated_at', 'created_by')

    def get_privilege_card_details(self, obj):
        if obj.privilege_card:
            return {
                'card_type': obj.privilege_card.card_type,
                'discount_percentage': obj.privilege_card.discount_percentage
            }
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
        return super().create(validated_data)

class CustomerPDFSerializer(serializers.ModelSerializer):
    privilege_card_type = serializers.CharField(source='privilege_card.card_type', read_only=True)
    privilege_card_discount = serializers.IntegerField(source='privilege_card.discount_percentage', read_only=True)

    class Meta:
        model = Customers
        fields = [
            'customer_id', 'name', 'address', 'place', 'pin_code', 
            'email', 'phone', 'privilege_card_type', 'privilege_card_discount'
        ]