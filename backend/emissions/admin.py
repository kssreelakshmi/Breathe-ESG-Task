from django.contrib import admin
from .models import Company, User, IngestionBatch, EmissionRecord, AuditLog
from django.contrib.auth.admin import UserAdmin


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display  = ['id', 'company_name', 'slug', 'country', 'created_at']
    search_fields = ['company_name', 'slug']


@admin.register(IngestionBatch)
class IngestionBatchAdmin(admin.ModelAdmin):
    list_display  = ['id', 'company', 'source_type', 'filename', 'uploaded_by', 'uploaded_at', 'status', 'total_rows', 'failed_rows']
    list_filter   = ['source_type', 'status']
    search_fields = ['filename', 'company__company_name']


@admin.register(EmissionRecord)
class EmissionRecordAdmin(admin.ModelAdmin):
    list_display  = ['id', 'company', 'scope', 'category', 'source_ref', 'quantity_normalized', 'unit_normalized', 'period_start', 'status', 'is_flagged', 'is_locked']
    list_filter   = ['scope', 'status', 'is_flagged', 'is_locked']
    search_fields = ['source_ref', 'category', 'company__company_name']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display  = ['id', 'record', 'action', 'performed_by', 'performed_at', 'notes']
    list_filter   = ['action']
    search_fields = ['record__id', 'performed_by__username']


class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'role', 'company', 'is_superuser', 'is_active']

    fieldsets = UserAdmin.fieldsets + (
        (
            'Custom Fields',
            {
                'fields': (
                    'role',
                    'company',
                )
            },
        ),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        (
            'Custom Fields',
            {
                'fields': (
                    'role',
                    'company',
                )
            },
        ),
    )


admin.site.register(User, CustomUserAdmin)
