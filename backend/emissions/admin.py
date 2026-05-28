from django.contrib import admin
from .models import Company,User, IngestionBatch, EmissionRecord, AuditLog
from django.contrib.auth.admin import UserAdmin

admin.site.register(Company)
admin.site.register(IngestionBatch)
admin.site.register(EmissionRecord)
admin.site.register(AuditLog)


class CustomUserAdmin(UserAdmin):

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