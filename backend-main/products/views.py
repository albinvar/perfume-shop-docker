from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from .models import Product
from .serializers import ProductSerializer
import logging
import cloudinary
import cloudinary.uploader
from django.shortcuts import get_object_or_404

logger = logging.getLogger(__name__)

class ProductViewSet(viewsets.ModelViewSet):
    parser_classes = (MultiPartParser, FormParser)
    queryset = Product.objects.all().select_related(
        'category', 'tax1', 'tax2', 'unit', 'store'
    ).prefetch_related('store')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['category', 'tax1', 'tax2', 'unit', 'store']
    search_fields = ['name', 'product_code', 'barcode', 'hsn_code']
    ordering_fields = [
        'name', 'mrp', 'created_at', 
        'discount', 'calculated_price'
    ]
    ordering = ['-created_at']

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == 'STAFF' and hasattr(user, 'store'):
            serializer.save(created_by=user, store=user.store)
        else:
            serializer.save(created_by=user)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error creating product: {str(e)}")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"Error updating product: {str(e)}")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def upload_image(self, request, pk=None):
        product = get_object_or_404(Product, pk=pk)
        if 'image' not in request.FILES:
            return Response(
                {'error': 'No image file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            if product.image:
                cloudinary.uploader.destroy(product.image)
            
            image = request.FILES['image']
            result = cloudinary.uploader.upload(
                image,
                folder=f"products/{product.id}",
                public_id=f"product_{product.id}",
                resource_type="image",
                quality="auto:good",
                width=800,
                height=800,
                crop="limit"
            )
            product.image = result['public_id']
            product.save()
            
            serializer = self.get_serializer(product)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error uploading product image: {str(e)}")
            return Response(
                {'error': 'Failed to upload image'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['delete'])
    def remove_image(self, request, pk=None):
        product = get_object_or_404(Product, pk=pk)
        if not product.image:
            return Response(
                {'error': 'Product has no image to remove'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            cloudinary.uploader.destroy(product.image)
            product.image = None
            product.save()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error removing product image: {str(e)}")
            return Response(
                {'error': 'Failed to remove image'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_update(self, serializer):
        instance = self.get_object()
        existing_image = instance.image
        user = self.request.user

        updated_instance = serializer.save(updated_by=user)

        # Delete old image if it was replaced
        if 'image' in serializer.validated_data and existing_image != serializer.validated_data['image']:
            if existing_image:
                try:
                    cloudinary.uploader.destroy(existing_image)
                except Exception as e:
                    logger.error(f"Error deleting old image: {str(e)}")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.image:
            try:
                cloudinary.uploader.destroy(instance.image)
            except Exception as e:
                logger.error(f"Error deleting product image: {str(e)}")
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)