from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from .models import PrivilegeCard, Customers
from .serializers import PrivilegeCardSerializer, CustomerSerializer, CustomerPDFSerializer
from django.http import HttpResponse
from io import BytesIO
from reportlab.lib.pagesizes import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib import colors
from datetime import datetime

class PrivilegeCardViewSet(viewsets.ModelViewSet):
    queryset = PrivilegeCard.objects.all()
    serializer_class = PrivilegeCardSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        if instance.customers.exists():
            return Response(
                {"detail": "Cannot delete privilege card as it is assigned to customers."},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customers.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def download_card(self, request, pk=None):
        customer = self.get_object()
        serializer = CustomerPDFSerializer(customer)
        data = serializer.data
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=(4.375 * inch, 3.125 * inch),
            leftMargin=0.2 * inch,
            rightMargin=0.2 * inch,
            topMargin=0.3 * inch,
            bottomMargin=0.3 * inch
        )
        
        card_type = data.get('privilege_card_type', 'BASIC')
        if card_type == 'PREMIUM':
            bg_color = colors.HexColor('#FFD700')
            text_color = colors.black
        elif card_type == 'STANDARD':
            bg_color = colors.HexColor('#C0C0C0')
            text_color = colors.black
        else:
            bg_color = colors.HexColor('#CD7F32')
            text_color = colors.white
        
        card_data = [
            ["PRIVILEGE CARD", "", f"Valid: {datetime.now().strftime('%m/%y')}"],
            ["", "", ""],
            [f"ID: {data['customer_id']}", "", ""],
            ["", "", ""],
            [f"Name: {data['name']}", "", ""],
            ["", "", ""],
            [f"Place: {data['place']}", "", ""],
            ["", "", ""],
            [f"Type: {card_type}", "", f"Discount: {data['privilege_card_discount']}%"],
            ["", "", f"Issued: {datetime.now().strftime('%Y-%m-%d')}"],
        ]
        
        card_table = Table(card_data, colWidths=[1.5*inch, 0.5*inch, 1.2*inch])
        card_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg_color),
            ('TEXTCOLOR', (0, 0), (-1, -1), text_color),
            ('ALIGN', (0, 0), (-1, -2), 'LEFT'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('LEADING', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('SPAN', (0, 0), (1, 0)),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 2), (-1, -1), 8),
            ('FONTNAME', (0, 2), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (2, -1), (2, -1), 'RIGHT'),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.white),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
        ])
        
        card_table.setStyle(card_style)
        doc.build([card_table])
        
        buffer.seek(0)
        response = HttpResponse(
            buffer.getvalue(),
            content_type='application/pdf',
            headers={
                'Content-Disposition': f'attachment; filename="privilege_card_{data["customer_id"]}.pdf"',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )
        return response