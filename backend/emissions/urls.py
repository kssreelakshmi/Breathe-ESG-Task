from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('auth/me/', views.me_view, name='me'),

    path('company/', views.company_list_view, name='company-list'),

    path('ingest/sap/', views.upload_sap, name='upload-sap'),
    path('ingest/utility/', views.upload_utility, name='upload-utility'),
    path('ingest/travel/', views.upload_travel, name='upload-travel'),

    path('records/', views.get_records, name='record-list'),
    path('records/<int:pk>/', views.get_record_detail, name='record-detail'),
    path('records/<int:pk>/approve/', views.approve_record, name='approve-record'),
    path('records/<int:pk>/reject/', views.reject_record, name='reject-record'),

    path('batches/', views.get_batches, name='batch-list'),
    path('summary/', views.get_summary, name='summary'),

    path('auth/logout/', views.logout_view),
]