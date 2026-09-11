import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'casevault_backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

SEED_USERS = []

def run_seed():
    print("Clean start: No seed accounts to insert into Django DB.")

if __name__ == '__main__':
    run_seed()

