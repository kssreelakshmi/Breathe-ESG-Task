from rest_framework.permissions import BasePermission


class IsStaff(BasePermission):
    """
    Only allows users with role = 'staff'.
    Used for upload endpoints.
    """
    message = 'Only staff members can upload data.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (request.user.role == 'staff' or request.user.is_superuser)
        )


class IsAnalyst(BasePermission):
    """
    Only allows users with role = 'analyst'.
    Used for approve/reject endpoints.
    """
    message = 'Only analysts can approve or reject records.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (request.user.role == 'analyst' or request.user.is_superuser)
        )