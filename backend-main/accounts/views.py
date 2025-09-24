from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth.hashers import check_password
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny
from rest_framework import serializers
from rest_framework.parsers import MultiPartParser, FormParser
from .serializers import StoreSerializer, PasswordChangeSerializer
from django.core.files.storage import default_storage
import os
from .models import Store
from rest_framework.permissions import IsAuthenticated, IsAdminUser
import logging
from django.db import transaction
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import User, Registration
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserRegistrationSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    UserSerializer
)
from rest_framework.views import APIView
import cloudinary.uploader

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            user = User.objects.get(username=request.data['username'])
            user_data = UserProfileSerializer(user).data
            response.data['user'] = user_data
        return response

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_staff_stores(request):
    username = request.GET.get('username')
    if not username:
        return Response({'error': 'Username parameter is required'}, status=400)
    
    try:
        user = User.objects.get(username=username, role='STAFF')
        if user.store:
            return Response({
                'stores': [{
                    'id': user.store.id,
                    'name': user.store.name,
                    'address': user.store.place
                }],
                'assigned': True
            })
        return Response({
            'stores': [],
            'assigned': False,
            'message': 'No store assigned to this staff member'
        })
    except User.DoesNotExist:
        return Response({
            'error': 'Staff user not found',
            'stores': []
        }, status=404)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    try:
        user = request.user
        data = request.data
        
        # Ensure we're working with the current user
        serializer = UserUpdateSerializer(user, data=data, partial=True)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            updated_user = serializer.save()
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        # Return the updated user data
        return Response({
            'message': 'Profile updated successfully',
            'user': UserProfileSerializer(updated_user).data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Profile update error: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    try:
        user = request.user
        data = request.data

        if 'current_password' not in data or 'new_password' not in data:
            return Response(
                {'error': 'Both current and new password are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not user.check_password(data['current_password']):
            return Response(
                {'current_password': ['Current password is incorrect']},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password(data['new_password'], user)
        except ValidationError as e:
            return Response(
                {'new_password': list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        if data['new_password'] == data['current_password']:
            return Response(
                {'new_password': ['New password must be different from current password']},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(data['new_password'])
        user.save()

        # Update registration record if exists
        Registration.objects.update_or_create(
            user=user,
            defaults={
                'password': data['new_password'],
                'image': user.photo if hasattr(user, 'photo') else None,
                'user_role': user.role
            }
        )

        return Response(
            {'message': 'Password updated successfully'},
            status=status.HTTP_200_OK
        )

    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

class UserRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

class AdminRegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]
    
    def perform_create(self, serializer):
        # Check if any admin exists
        if User.objects.filter(role='ADMIN').exists():
            raise serializers.ValidationError(
                {'error': 'An admin already exists. Only one admin is allowed.'}
            )
        
        # Create the admin user
        user = serializer.save(
            role='ADMIN',
            is_superuser=True
        )
        
        # Create registration record
        Registration.objects.update_or_create(
            user=user,
            defaults={
                'password': self.request.data.get('password'),
                'image': user.photo,
                'user_role': 'ADMIN'
            }
        )

class CheckAdminExistsView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        admin_count = User.objects.filter(role='ADMIN').count()
        return Response({
            'admin_exists': admin_count > 0,
            'admin_count': admin_count,
            'message': 'Only one admin is allowed in the system' if admin_count > 0 else ''
        })


class UserProfileView(generics.RetrieveAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    try:
        user = request.user
        serializer = UserProfileSerializer(user)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class UserUpdateView(generics.UpdateAPIView):
    serializer_class = UserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}
            
        return Response(UserProfileSerializer(instance).data)

class CheckAdminExistsView(APIView):
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        admin_count = User.objects.filter(role='ADMIN').count()
        return Response({
            'admin_exists': admin_count > 0,
            'admin_count': admin_count,
            'message': 'Only one admin is allowed in the system' if admin_count > 0 else ''
        })

class StaffUpdateView(generics.UpdateAPIView):
    serializer_class = UserUpdateSerializer
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        return User.objects.filter(role='STAFF')
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            updated_user = serializer.save()
            
            registration, created = Registration.objects.get_or_create(
                user=instance,
                defaults={
                    'password': request.data.get('new_password', instance.password),
                    'image': instance.photo,
                    'user_role': instance.role
                }
            )
            
            if not created:
                if 'new_password' in request.data:
                    registration.password = request.data['new_password']
                if 'photo' in request.FILES:
                    registration.image = request.FILES['photo']
                registration.save()
            
        return Response({
            'message': 'Staff member updated successfully',
            'staff': UserSerializer(updated_user, context={'request': request}).data
        })

class StaffDeleteView(generics.DestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    queryset = User.objects.filter(role='STAFF')
    
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            
            if request.user.role != 'ADMIN':
                return Response(
                    {'detail': 'Only admin users can delete staff members'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Delete user photo from Cloudinary if exists
            if instance.photo:
                cloudinary.uploader.destroy(instance.photo.public_id)
            
            Registration.objects.filter(user=instance).delete()
            instance.delete()
            
            return Response(
                {'detail': 'Staff member deleted successfully'},
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

class StaffListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        if self.request.user.role == 'ADMIN':
            return User.objects.filter(role='STAFF').order_by('-date_joined')
        return User.objects.none()
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user and request.user.role == 'ADMIN'

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.role == 'ADMIN'

class StoreListCreateView(generics.ListCreateAPIView):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated(), IsAdminUser()]

class StoreRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Store.objects.all()
    serializer_class = StoreSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]
    
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            
            if instance.photo:
                try:
                    public_id = instance.photo.public_id if hasattr(instance.photo, 'public_id') else instance.photo
                    uploader.destroy(public_id)
                except Exception as e:
                    logger.error(f"Error deleting store photo: {str(e)}")
            
            self.perform_destroy(instance)
            return Response(
                {'message': 'Store deleted successfully'},
                status=status.HTTP_204_NO_CONTENT
            )
        except Exception as e:
            logger.error(f"Error deleting store: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_store(request):
    if request.user.role != 'STAFF':
        return Response(
            {'error': 'This endpoint is for staff only'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    if not request.user.store:
        return Response(
            {'error': 'No store assigned to your account'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    
    store = request.user.store
    serializer = StoreSerializer(store)
    return Response(serializer.data)