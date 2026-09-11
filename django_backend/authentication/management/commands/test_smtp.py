import sys
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.conf import settings
from smtplib import SMTPAuthenticationError, SMTPException

class Command(BaseCommand):
    help = 'Tests Gmail SMTP connectivity using configured environment credentials.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--recipient',
            type=str,
            help='Optional email address to send test message to',
            default=None
        )

    def handle(self, *args, **options):
        recipient = options.get('recipient') or settings.EMAIL_HOST_USER
        
        self.stdout.write(self.style.MIGRATE_HEADING('=== CASEVAULT Gmail SMTP Diagnostics ==='))
        self.stdout.write(f'Host: {settings.EMAIL_HOST}:{settings.EMAIL_PORT}')
        self.stdout.write(f'TLS: {settings.EMAIL_USE_TLS}')
        self.stdout.write(f'User: {settings.EMAIL_HOST_USER or "(Not Set)"}')
        self.stdout.write(f'Password Set: {"Yes (Hidden)" if settings.EMAIL_HOST_PASSWORD else "No"}')
        self.stdout.write(f'Target Recipient: {recipient or "(None)"}')
        self.stdout.write('--------------------------------------------')

        if not settings.EMAIL_HOST_USER or settings.EMAIL_HOST_USER == 'YOUR_GMAIL_ADDRESS@gmail.com':
            self.stdout.write(self.style.WARNING(
                'Notice: EMAIL_HOST_USER is still set to the default placeholder. '
                'Please update your .env file with your actual Gmail address & App Password.'
            ))

        try:
            sent_count = send_mail(
                subject='[CASEVAULT Test] Gmail SMTP Diagnostic Check',
                message='This is an automated test email from the CASEVAULT Django Backend.',
                from_email=settings.DEFAULT_FROM_EMAIL or settings.EMAIL_HOST_USER,
                recipient_list=[recipient] if recipient else [],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(
                f'SUCCESS: Test email dispatched successfully to {recipient} (Sent count: {sent_count})'
            ))
        except SMTPAuthenticationError as e:
            self.stdout.write(self.style.ERROR(
                f'SMTP AUTHENTICATION FAILED: {type(e).__name__}: {e.smtp_code} - {e.smtp_error.decode("utf-8", errors="ignore") if isinstance(e.smtp_error, bytes) else e.smtp_error}'
            ))
            self.stdout.write(self.style.WARNING(
                'Tip: Ensure you are using a 16-character Gmail App Password (not your primary Gmail password) and 2-Step Verification is ON.'
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f'SMTP ERROR ({type(e).__name__}): {str(e)}'
            ))
