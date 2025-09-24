from rest_framework import serializers
from .models import Category, Tax, Printer, Unit, LoginSettings
from django.contrib.auth import get_user_model
import cloudinary.uploader

User = get_user_model()

class BaseSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField()
    updated_by = serializers.StringRelatedField()

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            validated_data['created_by'] = user
            validated_data['updated_by'] = user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            user = request.user
            validated_data['updated_by'] = user
        return super().update(instance, validated_data)

class CategorySerializer(BaseSerializer):
    class Meta:
        model = Category
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')

class TaxSerializer(BaseSerializer):
    class Meta:
        model = Tax
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')

    def validate_rate(self, value):
        if value <= 0 or value > 100:
            raise serializers.ValidationError("Tax rate must be between 0 and 100")
        return value

class PrinterSerializer(BaseSerializer):
    class Meta:
        model = Printer
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')

    def validate_ip_address(self, value):
        parts = value.split('.')
        if len(parts) != 4:
            raise serializers.ValidationError("Invalid IP address format")
        for part in parts:
            try:
                num = int(part)
                if num < 0 or num > 255:
                    raise ValueError
            except ValueError:
                raise serializers.ValidationError("Invalid IP address format")
        return value

class UnitSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    
    class Meta:
        model = Unit
        fields = ['id', 'name', 'type', 'type_display', 'symbol', 
                 'created_at', 'updated_at', 'created_by', 'updated_by']
        read_only_fields = ('id', 'created_at', 'updated_at', 
                          'created_by', 'updated_by', 'type_display')

    def validate(self, data):
        errors = {}
        
        if not data.get('name'):
            errors['name'] = "Name is required"
            
        valid_types = [choice[0] for choice in Unit.UNIT_TYPES]
        if data.get('type') not in valid_types:
            errors['type'] = f"Type must be one of: {', '.join(valid_types)}"
            
        if not data.get('symbol'):
            errors['symbol'] = "Symbol is required"
        elif len(data.get('symbol')) > 5:
            errors['symbol'] = "Symbol cannot exceed 5 characters"
            
        if errors:
            raise serializers.ValidationError(errors)
            
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['created_by'] = request.user
            validated_data['updated_by'] = request.user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['updated_by'] = request.user
        return super().update(instance, validated_data)

class LoginSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()
    logo = serializers.ImageField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = LoginSettings
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at', 'created_by', 'updated_by')
    
    def get_logo_url(self, obj):
        return obj.get_logo_url()
    
    def update(self, instance, validated_data):
        logo = validated_data.pop('logo', None)
        
        if logo is not None:
            if logo:
                if instance.logo:
                    cloudinary.uploader.destroy(instance.logo.public_id)
                instance.logo = logo
            else:
                if instance.logo:
                    cloudinary.uploader.destroy(instance.logo.public_id)
                instance.logo = None
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance