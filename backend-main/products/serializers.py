from rest_framework import serializers
from .models import Product
from django.conf import settings
import os
from django.utils import timezone
import logging
import cloudinary
import cloudinary.uploader
from django.core.files.uploadedfile import InMemoryUploadedFile

logger = logging.getLogger(__name__)

class ProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    category_name = serializers.CharField(source='category.name', read_only=True)
    tax1_name = serializers.SerializerMethodField()
    tax2_name = serializers.SerializerMethodField()
    unit_name = serializers.SerializerMethodField()
    store_name = serializers.CharField(source='store.name', read_only=True)
    calculated_price = serializers.DecimalField(
        max_digits=10, 
        decimal_places=2, 
        read_only=True
    )

    class Meta:
        model = Product
        fields = [
            'id', 'product_code', 'name', 'hsn_code', 'category', 'category_name',
            'description', 'mrp', 'discount', 'purchase_rate', 'sale_rate',
            'tax1', 'tax1_name', 'tax2', 'tax2_name', 'tax_type', 'opening_stock',
            'barcode', 'unit', 'unit_name', 'image', 'image_url', 'calculated_price',
            'created_at', 'updated_at', 'created_by', 'updated_by', 'is_active',
            'store', 'store_name'
        ]
        extra_kwargs = {
            'image': {'required': False, 'write_only': True},
            'category': {'required': False},
            'tax1': {'required': False},
            'tax2': {'required': False},
            'unit': {'required': False},
            'store': {'required': False},
            'discount': {'min_value': 0, 'max_value': 100}
        }

    def get_tax1_name(self, obj):
        return f"{obj.tax1.name} ({obj.tax1.rate}%)" if obj.tax1 else None

    def get_tax2_name(self, obj):
        return f"{obj.tax2.name} ({obj.tax2.rate}%)" if obj.tax2 else None

    def get_unit_name(self, obj):
        return f"{obj.unit.name} ({obj.unit.symbol})" if obj.unit else None

    def get_image_url(self, obj):
        if obj.image:
            if hasattr(obj.image, 'url'):
                return obj.image.url
            return f"https://res.cloudinary.com/dnjsec6b4/image/upload/{obj.image}"
        return None

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Ensure store is properly represented
        if representation.get('store') and isinstance(representation['store'], dict):
            representation['store_name'] = representation['store'].get('name', '')
        return representation

    def validate_image(self, value):
        if value:
            ext = os.path.splitext(value.name)[1].lower().replace('.', '')
            allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp']
            if ext not in allowed_extensions:
                raise serializers.ValidationError(
                    f"File extension '{ext}' is not allowed. Allowed extensions are: {', '.join(allowed_extensions)}"
                )
        return value

    def validate(self, data):
        # Validate that tax2 is not the same as tax1
        if 'tax1' in data and 'tax2' in data:
            if data['tax1'] and data['tax2'] and data['tax1'] == data['tax2']:
                raise serializers.ValidationError("Tax 1 and Tax 2 cannot be the same")
        
        # Validate discount is between 0 and 100
        if 'discount' in data:
            discount = float(data['discount'])
            if discount < 0 or discount > 100:
                raise serializers.ValidationError("Discount must be between 0 and 100 percent")
        
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user if request else None
        
        image = validated_data.pop('image', None)
        product = Product.objects.create(**validated_data)
        
        if image and isinstance(image, InMemoryUploadedFile):
            try:
                result = cloudinary.uploader.upload(
                    image,
                    folder=f"products/{product.id}",
                    public_id=f"product_{product.id}_{timezone.now().strftime('%Y%m%d%H%M%S')}",
                    resource_type="image",
                    quality="auto:good",
                    width=800,
                    height=800,
                    crop="limit"
                )
                product.image = result['public_id']
                product.save()
            except Exception as e:
                logger.error(f"Error uploading image to Cloudinary: {str(e)}")
                product.delete()
                raise serializers.ValidationError(
                    {'image': 'Failed to upload image to Cloudinary. Please try again.'}
                )
        
        return product

    def update(self, instance, validated_data):
        request = self.context.get('request')
        user = request.user if request else None
        
        image = validated_data.pop('image', None)
        
        if image is not None:
            try:
                if isinstance(image, InMemoryUploadedFile):
                    if instance.image:
                        try:
                            cloudinary.uploader.destroy(instance.image)
                        except Exception as e:
                            logger.error(f"Error deleting old image: {str(e)}")
                    
                    result = cloudinary.uploader.upload(
                        image,
                        folder=f"products/{instance.id}",
                        public_id=f"product_{instance.id}_{timezone.now().strftime('%Y%m%d%H%M%S')}",
                        resource_type="image",
                        quality="auto:good",
                        width=800,
                        height=800,
                        crop="limit"
                    )
                    instance.image = result['public_id']
                elif image is None:
                    if instance.image:
                        try:
                            cloudinary.uploader.destroy(instance.image)
                        except Exception as e:
                            logger.error(f"Error deleting old image: {str(e)}")
                    instance.image = None
            except Exception as e:
                logger.error(f"Error updating image in Cloudinary: {str(e)}")
                raise serializers.ValidationError(
                    {'image': 'Failed to update image in Cloudinary. Please try again.'}
                )
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.updated_by = user
        instance.save()
        
        return instance