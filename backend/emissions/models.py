from django.db import models
from django.contrib.auth.models import AbstractUser


# Create your models here.
class Company(models.Model):
    company_name = models.CharField(max_length =255)
    slug       = models.SlugField(unique=True)
    country = models.CharField(max_length = 100 ,default = 'India')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.company_name
    
    class Meta:
        verbose_name_plural = "Companies"

class User(AbstractUser):
    ROLE_CHOICES = [
        ('staff','Staff'),
        ('analyst','Analyst'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='staff')
    company = models.ForeignKey(Company, on_delete=models.SET_NULL, null=True, blank=True)


class IngestionBatch(models.Model):
    SOURCE_TYPES = [
        ('SAP',     'SAP Fuel & Procurement'),
        ('UTILITY', 'Utility / Electricity'),
        ('TRAVEL',  'Corporate Travel'),
    ]

    UPLOAD_STATUS = [
        ('PROCESSING', 'Processing'),
        ('COMPLETED',  'Completed'),
        ('FAILED',     'Failed'),
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='uploads')
    source_type = models.CharField(max_length=20, choices=SOURCE_TYPES)
    filename = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, choices=UPLOAD_STATUS, default='PROCESSING')
    total_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default = 0)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.company.company_name} - {self.source_type} - {self.uploaded_at.strftime('%Y-%m-%d %H:%M:%S')}"

    def _ingestion_short_summary(self):
        return f"{self.filename}/{self.source_type}"


class EmissionRecord(models.Model):

    SCOPE_CHOICES = [
        (1,'SCOPE 1 - Direct Emissions'),
        (2,'SCOPE 2 - Electricity'),
        (3,'SCOPE 3 - Indirect Emissions'),
    ]

    STATUS_CHOICES = [
        ('PENDING',  'Pending Review'),    # just uploaded, not reviewed
        ('APPROVED', 'Approved'),          # analyst approved it
        ('REJECTED', 'Rejected'),          # analyst rejected it
        ('FLAGGED',  'Flagged'),           # system auto-flagged as suspicious
    ]

    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='emission_records')
    ingestion = models.ForeignKey(IngestionBatch, on_delete=models.CASCADE, related_name='emission_records')
    
    source_ref = models.CharField(max_length=255, blank=True)
    raw_data   = models.JSONField(default=dict)
    scope = models.IntegerField(choices=SCOPE_CHOICES)
    category = models.CharField(max_length=100)
    
    period_start = models.DateField()
    period_end   = models.DateField(null=True, blank=True)
    
    quantity_raw = models.DecimalField(max_digits=20, decimal_places=4)
    unit_raw = models.CharField(max_length=50)

    quantity_normalized = models.DecimalField(max_digits=20, decimal_places=4)
    unit_normalized = models.CharField(max_length=50)

    location = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    is_locked    = models.BooleanField(default=False) 
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,related_name ="reviewed_emission_records")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    is_flagged = models.BooleanField(default=False)
    flag_reason = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.company.company_name} - {self.category} - {self.quantity_normalized} {self.unit_normalized} on {self.period_start}"
    
    def _ingestion_data(self):
        return f"{self.ingestion._ingestion_short_summary()}"
    class Meta:
        ordering = ['-period_start']


class AuditLog(models.Model):

    ACTION_CHOICES = [

        ('CREATED',  'Record Created'),
        ('EDITED',   'Record Edited'),
        ('APPROVED', 'Record Approved'),
        ('REJECTED', 'Record Rejected'),
        ('FLAGGED',  'Record Flagged'),
    ]        

    record = models.ForeignKey(EmissionRecord, on_delete=models.CASCADE, related_name='audit_logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    performed_at = models.DateTimeField(auto_now_add=True)
    old_value    = models.JSONField(null=True, blank=True)   
    new_value    = models.JSONField(null=True, blank=True)  
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.action} on Record #{self.record.id} by {self.performed_by}"
    
    class Meta:
        ordering = ['-performed_at']