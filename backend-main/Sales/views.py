from django.shortcuts import render
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Sale
from reportlab.lib.units import inch
from .serializers import SaleSerializer
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Sum, Q
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from io import BytesIO
from django.http import HttpResponse
import logging
from django.db import transaction

logger = logging.getLogger(__name__)

class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all().select_related(
        'store', 'customer', 'created_by', 'original_sale'
    ).prefetch_related('items__product')
    serializer_class = SaleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['store', 'date', 'payment_method', 'is_return']
    search_fields = ['invoice_no', 'customer__name', 'customer__phone']
    ordering_fields = ['date', 'invoice_no', 'final_amount']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        if user.role == 'STAFF' and user.store:
            queryset = queryset.filter(store=user.store)
        return queryset

    def perform_create(self, serializer):
        serializer.validated_data.pop('created_by', None)
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def return_sale(self, request, pk=None):
        sale = self.get_object()
        try:
            with transaction.atomic():
                return_sale = sale.return_sale()
                serializer = self.get_serializer(return_sale)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error creating return sale: {str(e)}", exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=False, methods=['get'])
    def last_invoice(self, request):
        store_id = request.query_params.get('store')
        if not store_id:
            if hasattr(request.user, 'store') and request.user.store:
                store_id = request.user.store.id
            else:
                return Response(
                    {'error': 'Store ID is required either as query parameter or user default store'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        last_sale = Sale.objects.filter(store_id=store_id).order_by('-created_at').first()
        
        if last_sale:
            import re
            match = re.search(r'\d+', last_sale.invoice_no)
            if match:
                last_num = int(match.group())
                next_num = last_num + 1
                next_invoice = f"SA{str(next_num).zfill(3)}"
            else:
                next_invoice = "SA001"
        else:
            next_invoice = "SA001"

        return Response({
            'last_invoice': last_sale.invoice_no if last_sale else None,
            'next_invoice': next_invoice,
            'store_id': store_id
        })
    @action(detail=True, methods=['get'])
    def download_invoice(self, request, pk=None):
        try:
            sale = self.get_object()
            buffer = BytesIO()

            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                leftMargin=0.5*inch,
                rightMargin=0.5*inch,
                topMargin=0.5*inch,
                bottomMargin=0.5*inch
            )

            styles = getSampleStyleSheet()
            elements = []

            # Title
            title_style = styles['Title']
            title_style.alignment = 1
            elements.append(Paragraph(f"INVOICE : {sale.invoice_no}", title_style))
            elements.append(Spacer(1, 0.25*inch))

            # Styles
            normal_style = styles['Normal']
            heading_style = styles['Heading2']
            heading_style.alignment = 0

            # Store Info
            store_info = [
                [Paragraph('<b>Store Information</b>', heading_style)],
                [Paragraph(f"<b>Name:</b> {sale.store.name}", normal_style)],
                [Paragraph(f"<b>Date:</b> {sale.date.strftime('%d/%m/%Y')}", normal_style)],
                [Paragraph(f"<b>Staff:</b> {sale.created_by.username if sale.created_by else ''}", normal_style)]
            ]

            # Customer Info
            if sale.customer:
                customer_info = [
                    [Paragraph('<b>Customer Information</b>', heading_style)],
                    [Paragraph(f"<b>Name:</b> {sale.customer.name}", normal_style)],
                    [Paragraph(f"<b>Phone:</b> {sale.customer.phone}", normal_style)],
                    [Paragraph(f"<b>Address:</b> {sale.customer.address}, {sale.customer.place}", normal_style)]
                ]
            else:
                customer_info = [
                    [Paragraph('<b>Customer Information</b>', heading_style)],
                    [Paragraph("Walk-in Customer", normal_style)]
                ]

            # Wrap each info section in a Table to align side-by-side
            store_table = Table(store_info, colWidths=[2.8*inch])
            customer_table = Table(customer_info, colWidths=[2.8*inch])

            info_table = Table(
                [[store_table, customer_table]],
                colWidths=[3*inch, 3*inch]
            )
            info_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('LEFTPADDING', (0,0), (-1,-1), 6),
                ('RIGHTPADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 12),
            ]))
            elements.append(info_table)
            elements.append(Spacer(1, 0.5*inch))

            # Items Table
            items_header_style = styles['Heading3']
            items_header_style.alignment = 1

            items_data = [
                [
                    Paragraph('<b>No:</b>', items_header_style),
                    Paragraph('<b>Product</b>', items_header_style),
                    Paragraph('<b>Qty</b>', items_header_style),
                    Paragraph('<b>Rate</b>', items_header_style),
                    Paragraph('<b>Amount</b>', items_header_style)
                ]
            ]

            for idx, item in enumerate(sale.items.all(), 1):
                product_text = f"{item.product.name} ({item.product.product_code})"
                items_data.append([
                    Paragraph(str(idx), normal_style),
                    Paragraph(product_text, normal_style),
                    Paragraph(str(item.quantity), normal_style),
                    Paragraph(f"{float(item.rate):.2f}", normal_style),
                    Paragraph(f"{float(item.amount):.2f}", normal_style)
                ])

            items_table = Table(items_data, colWidths=[0.5*inch, 3*inch, 0.75*inch, 1*inch, 1*inch])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fafafa")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('ALIGN', (1,0), (1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,0), 10),
                ('BOTTOMPADDING', (0,0), (-1,0), 12),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor("#080808")),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ]))
            elements.append(items_table)
            elements.append(Spacer(1, 0.5*inch))

            # Totals
            totals_data = [
                [Paragraph('<b>Subtotal:</b>', normal_style), Paragraph(f"{float(sale.total_amount):.2f}", normal_style)],
                [Paragraph('<b>Discount:</b>', normal_style), Paragraph(f"-{float(sale.discount_amount):.2f}", normal_style)],
                [Paragraph('<b>Tax:</b>', normal_style), Paragraph(f"{float(sale.tax_amount):.2f}", normal_style)],
                [Paragraph('<b>Total:</b>', styles['Heading2']), Paragraph(f"{float(sale.final_amount):.2f}", styles['Heading2'])],
                [Paragraph('<b>Payment Method:</b>', normal_style), Paragraph(sale.get_payment_method_display(), normal_style)],
            ]

            totals_table = Table(totals_data, colWidths=[2*inch, 2*inch])
            totals_table.setStyle(TableStyle([
                ('ALIGN', (0,0), (0,-1), 'RIGHT'),
                ('ALIGN', (1,0), (1,-1), 'RIGHT'),
                ('FONTNAME', (0,-1), (1,-1), 'Helvetica-Bold'),
                ('FONTSIZE', (0,-1), (1,-1), 12),
                ('LINEABOVE', (0,-1), (1,-1), 1, colors.black),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ]))
            elements.append(totals_table)
            elements.append(Spacer(1, 0.5*inch))

            # Footer
            footer_style = styles['Italic']
            footer_style.alignment = 1
            elements.append(Paragraph("Thank you for your business!", footer_style))
            elements.append(Paragraph("Please contact us for any questions or concerns", footer_style))

            # Build PDF
            doc.build(elements)
            buffer.seek(0)

            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="invoice_{sale.invoice_no}.pdf"'
            return response

        except Exception as e:
            logger.error(f"Error generating invoice PDF: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate invoice. Please try again later.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )