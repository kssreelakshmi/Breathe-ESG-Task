from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .permissions import IsStaff, IsAnalyst
from .exceptions import UnsupportedFileError

from .models import Company, EmissionRecord, IngestionBatch, AuditLog, User
from .serializers import (
    CompanySerializer,
    UserSerializer,
    EmissionRecordListSerializer,
    EmissionRecordDetailSerializer,
    IngestionBatchSerializer,
    AuditLogSerializer,
)
from .parsers.sap_parser import parse_sap_csv
from .parsers.utility_parser import parse_utility_csv
from .parsers.travel_parser  import parse_travel_csv


# AUTH 
@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Takes username + password, returns auth token.
    """
    username = request.data.get('username')
    password = request.data.get('password')
    
    
    if not username or not password:
        return Response(
            {'error': 'Username and password required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    if not user.check_password(password):
        return Response(
            {'error': 'Invalid credentials'},
            status=status.HTTP_401_UNAUTHORIZED
        )
    # get or create token for this user
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user':  UserSerializer(user).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    Returns current logged in user info.
    """
    return Response(UserSerializer(request.user).data)


#COMPANIES
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_list_view(request):
    """
    Returns all companies the current user has access to.
    Staff and analysts only see their assigned companies.
    """
    user = request.user

    # superusers see everything
    if user.is_superuser:
        companies = Company.objects.all()
    else:
        # ForeignKey — user has one company
        if user.company:
            companies = Company.objects.filter(id=user.company.id)
        else:
            companies = Company.objects.none()

    serializer = CompanySerializer(companies, many=True)
    return Response(serializer.data)


#INGESTION 
def _handle_upload(request, source_type, parser_fn):
    """
    Shared logic for all 3 upload endpoints.
    Avoids repeating the same 40 lines 3 times.
    """
    file = request.FILES.get('file')
    if not file:
        return Response(
            {'error': 'No file provided'},
            status=status.HTTP_400_BAD_REQUEST
        )

    company_id = request.data.get('company_id')
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response(
            {'error': 'Company not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if not request.user.is_superuser:
        if request.user.company != company:      # ForeignKey comparison
            return Response(
                {'error': 'You do not have access to this company'},
                status=status.HTTP_403_FORBIDDEN
            )

    # create batch record
    batch = IngestionBatch.objects.create(
        company = company,
        source_type = source_type,
        filename = file.name,
        uploaded_by = request.user,      # real user, not hardcoded
        status = 'PROCESSING'
    )

    try:
        file_content = file.read()
        results = parser_fn(file_content, company, batch, request.user)

        batch.status      = 'COMPLETED'
        batch.total_rows  = results['success'] + results['failed']
        batch.failed_rows = results['failed']
        batch.notes       = str(results.get('errors', ''))
        batch.save()

        return Response({
            'message':    f'{source_type} file processed successfully',
            'batch_id':   batch.id,
            'success':    results['success'],
            'failed':     results['failed'],
            'errors':     results.get('errors', []),
        }, status=status.HTTP_201_CREATED)

    except UnsupportedFileError as e:
        batch.status = 'FAILED'
        batch.notes  = str(e)
        batch.save()
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

    except Exception as e:
        batch.status = 'FAILED'
        batch.notes  = str(e)
        batch.save()
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
@permission_classes([IsStaff])
def upload_sap(request):
    return _handle_upload(request, 'SAP', parse_sap_csv)


@api_view(['POST'])
@permission_classes([IsStaff])
def upload_utility(request):
    return _handle_upload(request, 'UTILITY', parse_utility_csv)


@api_view(['POST'])
@permission_classes([IsStaff])
def upload_travel(request):
    return _handle_upload(request, 'TRAVEL', parse_travel_csv)

# RECORDS
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_records(request):
    """
    Returns emission records.
    Filters: status, company_id, source_type, scope, is_flagged
    """

    records = EmissionRecord.objects.select_related(
        'company',
        'ingestion',
        'reviewed_by'
    )

    if not request.user.is_superuser:
        records = records.filter(company=request.user.company)

    # optional filters from query params
    status_filter = request.GET.get('status')
    if status_filter:
        records = records.filter(status=status_filter)

    company_id = request.GET.get('company_id')
    if company_id:
        records = records.filter(company_id=company_id)

    source_type = request.GET.get('source_type')
    if source_type:
        records = records.filter(
            ingestion__source_type=source_type
        )

    scope = request.GET.get('scope')
    if scope:
        records = records.filter(scope=scope)

    is_flagged = request.GET.get('is_flagged')
    if is_flagged == 'true':
        records = records.filter(is_flagged=True)

    # newest first
    records = records.order_by('-created_at')

    serializer = EmissionRecordListSerializer(records, many=True)

    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_record_detail(request, pk):
    """
    Single record with full audit log history.
    """
    try:
        record = EmissionRecord.objects.select_related(
            'company', 'ingestion', 'reviewed_by'
        ).prefetch_related('audit_logs').get(pk=pk)
    except EmissionRecord.DoesNotExist:
        return Response(
            {'error': 'Record not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    serializer = EmissionRecordDetailSerializer(record)
    return Response(serializer.data)


#  REVIEW ACTIONS

@api_view(['PATCH'])
@permission_classes([IsAnalyst])
def approve_record(request, pk):
    """
    Analyst approves a record.
    Locks it — no further edits possible.
    """
    try:
        record = EmissionRecord.objects.get(pk=pk)
    except EmissionRecord.DoesNotExist:
        return Response(
            {'error': 'Record not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # block if already locked
    if record.is_locked:
        return Response(
            {'error': 'Record is locked and cannot be modified'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if record.status == 'APPROVED':
        return Response(
            {'error': 'Record already approved'},
            status=status.HTTP_400_BAD_REQUEST
        )

    old_status = record.status

    record.status       = 'APPROVED'
    record.is_locked    = True                  # lock after approval
    record.reviewed_by  = request.user          # real user
    record.reviewed_at  = timezone.now()
    record.review_notes = request.data.get('notes', '')
    record.save()

    AuditLog.objects.create(
        record       = record,
        action       = 'APPROVED',
        performed_by = request.user,
        old_value    = {'status': old_status},   # JSONField needs dict
        new_value    = {'status': 'APPROVED'},
        notes        = request.data.get('notes', '')
    )

    return Response({'message': 'Record approved and locked', 'id': pk})


@api_view(['PATCH'])
@permission_classes([IsAnalyst])
def reject_record(request, pk):
    """
    Analyst rejects a record.
    Notes are required when rejecting.
    """
    try:
        record = EmissionRecord.objects.get(pk=pk)
    except EmissionRecord.DoesNotExist:
        return Response(
            {'error': 'Record not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    if record.is_locked:
        return Response(
            {'error': 'Record is locked and cannot be modified'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # notes required when rejecting — analyst must say why
    notes = request.data.get('notes', '')
    if not notes:
        return Response(
            {'error': 'Please provide a reason for rejection'},
            status=status.HTTP_400_BAD_REQUEST
        )

    old_status = record.status

    record.status       = 'REJECTED'
    record.reviewed_by  = request.user
    record.reviewed_at  = timezone.now()
    record.review_notes = notes
    record.save()

    AuditLog.objects.create(
        record       = record,
        action       = 'REJECTED',
        performed_by = request.user,
        old_value    = {'status': old_status},
        new_value    = {'status': 'REJECTED'},
        notes        = notes
    )

    return Response({'message': 'Record rejected', 'id': pk})


# BATCHES 

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_batches(request):
    """
    Returns ingestion history — all upload batches.
    """
    batches = IngestionBatch.objects.select_related('company', 'uploaded_by')

    if not request.user.is_superuser:
        batches = batches.filter(company=request.user.company)  # ForeignKey

    company_id = request.GET.get('company_id')
    if company_id:
        batches = batches.filter(company_id=company_id)

    serializer = IngestionBatchSerializer(batches, many=True)
    return Response(serializer.data)


# SUMMARY 
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_summary(request):
    """
    Dashboard header counts.
    """
    records = EmissionRecord.objects.all()

    if not request.user.is_superuser:
        records = records.filter(company=request.user.company) 

    company_id = request.GET.get('company_id')
    if company_id:
        records = records.filter(company_id=company_id)

    return Response({
        'total':    records.count(),
        'pending':  records.filter(status='PENDING').count(),
        'approved': records.filter(status='APPROVED').count(),
        'rejected': records.filter(status='REJECTED').count(),
        'flagged':  records.filter(is_flagged=True).count(),
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Deletes the user's auth token from the database.
    After this, the token is invalid even if someone still has it.
    """
    request.user.auth_token.delete()
    return Response({'message': 'Logged out successfully'})    