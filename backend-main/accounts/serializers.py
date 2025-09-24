from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Registration, Store
from django.core.files.base import ContentFile
import base64
import re
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.core.validators import FileExtensionValidator
import cloudinary.uploader
import cloudinary

User = get_user_model()


class StoreSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Store
        fields = [
            'id', 'name', 'place', 'email', 'phone', 
            'store_id', 'photo', 'photo_url', 'gst_number',
            'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'photo': {'write_only': True, 'required': False},
        }

    def get_photo_url(self, obj):
        if obj.photo:
            # If photo is a CloudinaryField, use its url property
            if hasattr(obj.photo, 'url'):
                return obj.photo.url
            # If photo is just a string (public_id), construct the URL
            else:
                from cloudinary import CloudinaryImage
                return CloudinaryImage(str(obj.photo)).build_url()
        return None

    def validate_photo(self, value):
        if value and value.size > 5 * 1024 * 1024:  # 5MB limit
            raise serializers.ValidationError("Image size cannot exceed 5MB")
        return value

    def create(self, validated_data):
        photo = validated_data.pop('photo', None)
        store = Store.objects.create(**validated_data)
        
        if photo:
            try:
                result = cloudinary.uploader.upload(
                    photo,
                    folder="store_photos",
                    resource_type="image"
                )
                store.photo = result['public_id']
                store.save()
            except Exception as e:
                raise serializers.ValidationError(
                    {'photo': f'Failed to upload image: {str(e)}'}
                )
        
        return store

    def update(self, instance, validated_data):
        photo = validated_data.pop('photo', None)
        
        if photo is not None:  # None means we want to clear the photo
            try:
                # Delete old photo if exists
                if instance.photo:
                    cloudinary.uploader.destroy(instance.photo.public_id if hasattr(instance.photo, 'public_id') else instance.photo)
                
                if photo:  # New photo provided
                    result = cloudinary.uploader.upload(
                        photo,
                        folder="store_photos",
                        resource_type="image"
                    )
                    instance.photo = result['public_id']
                else:  # Empty photo means we want to remove it
                    instance.photo = None
            except Exception as e:
                raise serializers.ValidationError(
                    {'photo': f'Failed to update image: {str(e)}'}
                )
        
        # Update other fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.save()
        return instance

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
            
            request_store_id = self.context['request'].data.get('store_id')
            user = self.user
            
            if user.role == 'STAFF':
                if not user.store:
                    raise serializers.ValidationError({
                        'detail': 'Staff account is not assigned to any store. Contact admin.'
                    })
                
                if not request_store_id:
                    raise serializers.ValidationError({
                        'detail': 'Store selection is required for staff login'
                    })
                
                if str(user.store.id) != str(request_store_id):
                    raise serializers.ValidationError({
                        'detail': f'You are not authorized to access store {request_store_id}. Your assigned store is {user.store.id}'
                    })
            
            refresh = self.get_token(user)
            data['refresh'] = str(refresh)
            data['access'] = str(refresh.access_token)
            data['user'] = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'store': user.store.id if user.store else None,
                'photo_url': user.get_photo_url(),
            }
            
            return data
            
        except Exception as e:
            raise serializers.ValidationError({
                'detail': str(e)
            })

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    photo = serializers.ImageField(required=False)
    photo_url = serializers.SerializerMethodField()
    store_id = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.all(),
        source='store',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'phone', 
                 'address', 'place', 'role', 'photo', 'photo_url', 'password', 'store_id']
        extra_kwargs = {
            'password': {'write_only': True},
            'role': {'required': True}
        }
    
    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None
    
    def validate_role(self, value):
        if value not in ['ADMIN', 'STAFF']:
            raise serializers.ValidationError("Invalid role specified.")
        
        if value == 'ADMIN' and User.objects.filter(role='ADMIN').exists():
            raise serializers.ValidationError(
                "Admin registration is not allowed through this endpoint."
            )
        return value
    
    def create(self, validated_data):
        password = validated_data.pop('password')
        photo = validated_data.pop('photo', None)
        role = validated_data.get('role', 'STAFF')
        store = validated_data.pop('store', None)
        
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email'),
            password=password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            address=validated_data.get('address', ''),
            place=validated_data.get('place', ''),
            phone=validated_data.get('phone', ''),
            role=role,
            photo=photo,
            store=store
        )
        
        # Create registration record for all users
        Registration.objects.update_or_create(
            user=user,
            defaults={
                'password': password,
                'image': photo,
                'user_role': role
            }
        )
        
        return user

class UserProfileSerializer(serializers.ModelSerializer):
    store = serializers.PrimaryKeyRelatedField(read_only=True)
    photo_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name',
                 'phone', 'address', 'place', 'role', 'photo', 'photo_url', 'store']
        read_only_fields = ['id', 'role']

    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None

class UserUpdateSerializer(serializers.ModelSerializer):
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    photo = serializers.ImageField(required=False, allow_null=True)
    photo_url = serializers.SerializerMethodField()
    store_id = serializers.PrimaryKeyRelatedField(
        queryset=Store.objects.all(),
        source='store',
        write_only=True,
        required=False,
        allow_null=True
    )
    
    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email', 'phone', 
                 'address', 'place', 'current_password', 'new_password',
                 'photo', 'photo_url', 'store_id']
        extra_kwargs = {
            'username': {'required': False}
        }
    
    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None
    
    def validate_username(self, value):
        instance = getattr(self, 'instance', None)
        
        if instance and value == instance.username:
            return value
            
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        
        if len(value) < 3:
            raise serializers.ValidationError("Username must be at least 3 characters long.")
        if len(value) > 30:
            raise serializers.ValidationError("Username cannot be longer than 30 characters.")
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores."
            )
        
        return value
    
    def validate(self, data):
        if 'username' in data and data['username'] != self.instance.username:
            if 'current_password' not in data:
                raise serializers.ValidationError({
                    'current_password': 'Current password is required when changing username'
                })
        
        if 'new_password' in data:
            if 'current_password' not in data:
                raise serializers.ValidationError({
                    'current_password': 'Current password is required when changing password'
                })
            
            try:
                validate_password(data['new_password'], self.instance)
            except ValidationError as e:
                raise serializers.ValidationError({
                    'new_password': list(e.messages)
                })
            
            if data['new_password'] == data['current_password']:
                raise serializers.ValidationError({
                    'new_password': 'New password must be different from current password'
                })
        
        return data
    
    def update(self, instance, validated_data):
        current_password = validated_data.pop('current_password', None)
        new_password = validated_data.pop('new_password', None)
        photo = validated_data.pop('photo', None)
        
        if ('username' in validated_data and validated_data['username'] != instance.username) or new_password:
            if not instance.check_password(current_password):
                raise serializers.ValidationError({
                    'current_password': ['Current password is incorrect']
                })
        
        if new_password:
            instance.set_password(new_password)
            # Update registration record with new password
            Registration.objects.filter(user=instance).update(password=new_password)
        
        if photo:
            # Delete old photo if exists
            if instance.photo:
                cloudinary.uploader.destroy(instance.photo.public_id)
            instance.photo = photo
        
        if 'username' in validated_data:
            instance.username = validated_data['username']
        
        for attr, value in validated_data.items():
            if attr != 'username':
                setattr(instance, attr, value)
        
        instance.save()
        return instance
    
class UserSerializer(serializers.ModelSerializer):
    password = serializers.SerializerMethodField()
    store_name = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 
                'phone', 'address', 'place', 'role', 'photo', 'photo_url', 'store', 
                'store_name', 'password')
        read_only_fields = ('id', 'role')

    def get_photo_url(self, obj):
        if obj.photo:
            return obj.photo.url
        return None

    def get_password(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated and request.user.role == 'ADMIN':
            try:
                registration = Registration.objects.get(user=obj)
                return registration.password
            except Registration.DoesNotExist:
                return None
        return None

    def get_store_name(self, obj):
        return obj.store.name if obj.store else None

class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, data):
        user = self.context['request'].user
        
        if not user.check_password(data['current_password']):
            raise serializers.ValidationError({
                'current_password': ['Current password is incorrect']
            })
        
        try:
            validate_password(data['new_password'], user)
        except ValidationError as e:
            user_friendly_errors = []
            for error in e.messages:
                if "too common" in error:
                    user_friendly_errors.append("Password is too common. Please choose a stronger password.")
                elif "too short" in error:
                    user_friendly_errors.append("Password must be at least 8 characters long.")
                elif "entirely numeric" in error:
                    user_friendly_errors.append("Password cannot be entirely numeric.")
                else:
                    user_friendly_errors.append(error)
            
            raise serializers.ValidationError({
                'new_password': user_friendly_errors
            })
        
        if data['new_password'] == data['current_password']:
            raise serializers.ValidationError({
                'new_password': ['New password must be different from current password']
            })
        
        return data

    def save(self, **kwargs):
        user = self.context['request'].user
        new_password = self.validated_data['new_password']
        
        user.set_password(new_password)
        user.save()
        
        Registration.objects.update_or_create(
            user=user,
            defaults={
                'password': new_password,
                'image': user.photo if hasattr(user, 'photo') else None,
                'user_role': user.role
            }
        )
        
        return user