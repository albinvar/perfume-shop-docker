from rest_framework import serializers
from .models import Supplier, SupplierTransaction
from accounts.serializers import UserSerializer

class SupplierTransactionSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    
    class Meta:
        model = SupplierTransaction
        fields = '__all__'
        read_only_fields = ('transaction_no', 'created_at')

    def validate(self, data):
        if data['debit'] < 0 or data['credit'] < 0:
            raise serializers.ValidationError("Debit and credit amounts must be positive")
        return data

class SupplierSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    updated_by = UserSerializer(read_only=True)
    transactions = SupplierTransactionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'current_balance')

    def validate(self, data):
        required_fields = {
            'name': 'Supplier name is required',
            'address': 'Address is required',
            'city': 'City is required',
            'contact_no': 'Contact number is required',
        }
        
        errors = {}
        for field, message in required_fields.items():
            if not data.get(field):
                errors[field] = message
                
        if errors:
            raise serializers.ValidationError(errors)
            
        return data