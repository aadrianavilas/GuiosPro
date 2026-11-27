from apps.auth.models.auth.emailmfa import EmailMFACode


def select_email_code(**kwargs):
    """
    Retorna los códigos de email mfa que coincidan con los parámetros
    """
    return EmailMFACode.objects.filter(**kwargs).order_by('-created_at')
    
