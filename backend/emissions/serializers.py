from rest_framework import serializers
from .models import Company,User,EmissionRecord,IngestionBatch,AuditLog


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ['id', 'company_name', 'slug', 'country', 'created_at']

class UserSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.company_name',read_only=True,default=None)
    company_id = serializers.IntegerField(source='company.id',read_only=True,default=None)
    
    class Meta:
        model  = User
        fields = ['id', 'username', 'email', 'role', 'company_id', 'company_name']

class IngestionBatchSerializer(serializers.ModelSerializer):
     # readable fields on top of raw IDs
    company_name  = serializers.CharField(source='company.company_name', read_only=True)
    uploaded_by_name = serializers.SerializerMethodField()
    success_rows  = serializers.SerializerMethodField()

    class Meta:
        model  = IngestionBatch
        fields = [
            'id',
            'company',           
            'company_name',      
            'source_type',
            'filename',
            'uploaded_by',
            'uploaded_by_name',
            'uploaded_at',
            'status',
            'total_rows',
            'failed_rows',
            'success_rows',      
            'notes',
        ]
        read_only_fields = ['uploaded_at', 'status', 'total_rows', 'failed_rows']
    
    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.username if obj.uploaded_by else 'Unknown'

    def get_success_rows(self, obj):
        # total - failed = successful rows
        return obj.total_rows - obj.failed_rows

class AuditLogSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'action',
            'performed_by',
            'performed_by_name',
            'performed_at',
            'old_value',
            'new_value',
            'notes',
        ]

    def get_performed_by_name(self, obj):
        return obj.performed_by.username if obj.performed_by else "System"
    
class EmissionRecordListSerializer(serializers.ModelSerializer):

    company_name     = serializers.CharField(source='company.company_name', read_only=True)
    uploaded_at      = serializers.DateTimeField(source='ingestion.uploaded_at', read_only=True)
    source_type      = serializers.CharField(source='ingestion.source_type', read_only=True)
    reviewed_by_name = serializers.SerializerMethodField()
    scope_label      = serializers.SerializerMethodField()
    ingestion_data   = serializers.SerializerMethodField()


    class Meta:
        model  = EmissionRecord
        fields = [
            'id',
            'company',
            'company_name',
            'ingestion',
            'ingestion_data',   
            'source_type',       # SAP / UTILITY / TRAVEL
            'source_ref',        # PO number / meter ID / trip ID
            'scope',
            'scope_label',       # "Scope 1 - Direct Emissions"
            'category',          # diesel / electricity / flight
            'period_start',
            'period_end',
            'quantity_raw',
            'unit_raw',
            'quantity_normalized',
            'unit_normalized',
            'location',
            'description',
            'status',
            'is_locked',
            'is_flagged',
            'flag_reason',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'review_notes',
            'uploaded_at',       # when was this batch uploaded
            'created_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'is_locked']

    def get_reviewed_by_name(self, obj):
        return obj.reviewed_by.username if obj.reviewed_by else None

    def get_scope_label(self, obj):
        # returns "Scope 1" / "Scope 2" / "Scope 3" cleanly
        mapping = {1: 'Scope 1', 2: 'Scope 2', 3: 'Scope 3'}
        return mapping.get(obj.scope, 'Unknown')
    
    def get_ingestion_data(self, obj): 
        return obj._ingestion_data() 

class EmissionRecordDetailSerializer(EmissionRecordListSerializer):
    audit_logs = AuditLogSerializer(many=True, read_only=True)

    class Meta(EmissionRecordListSerializer.Meta):
        fields = EmissionRecordListSerializer.Meta.fields + [
            'raw_data',      # original CSV row
            'audit_logs',    # full history
        ]


class ReviewActionSerializer(serializers.Serializer):
    review_notes = serializers.CharField(required=False, allow_blank=True)