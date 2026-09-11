import re
from rest_framework import serializers
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    officerId = serializers.CharField(source='officer_id', read_only=True)
    badgeNumber = serializers.CharField(source='officer_id', read_only=True)
    badge_number = serializers.CharField(source='officer_id', read_only=True)
    policeStation = serializers.CharField(source='police_station', read_only=True)
    police_station = serializers.CharField(read_only=True)
    roleLabel = serializers.CharField(source='role_label', read_only=True)
    role_label = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'officerId',
            'officer_id',
            'badgeNumber',
            'badge_number',
            'name',
            'email',
            'rank',
            'policeStation',
            'police_station',
            'district',
            'role',
            'roleLabel',
            'role_label',
            'status',
            'avatar'
        ]

VALID_ROLE_RANKS = {
    'police_officer': {'Constable', 'Head Constable', 'ASI', 'Assistant Sub-Inspector', 'SI', 'Sub-Inspector', 'Police Officer'},
    'senior_officer': {'Inspector', 'Police Inspector', 'Senior Officer (SHO)', 'ACP / DSP', 'ACP', 'DSP', 'Deputy Superintendent of Police', 'Addl. SP', 'Additional Superintendent of Police', 'SP / SSP', 'SP', 'SSP', 'Superintendent of Police', 'DIG', 'Deputy Inspector General', 'IG', 'Inspector General', 'Inspector General of Police', 'ADGP', 'Additional Director General of Police', 'DGP', 'Director General of Police', 'IPS', 'IPS Officer'},
    'legal_officer': {'Legal Officer', 'Public Prosecutor', 'Assistant Public Prosecutor (APP)', 'Asst. Public Prosecutor (APP)', 'Assistant Public Prosecutor', 'APP', 'Legal Advisor', 'Law Officer'},
    'administrator': {'System Administrator', 'Administrative Officer', 'Department Administrator', 'IT / System Manager'}
}

ROLE_CATEGORY_ALIAS = {
    'officer': 'police_officer',
    'police_officer': 'police_officer',
    'police officer': 'police_officer',
    'senior_officer': 'senior_officer',
    'senior officer': 'senior_officer',
    'senior': 'senior_officer',
    'legal_officer': 'legal_officer',
    'legal officer': 'legal_officer',
    'legal': 'legal_officer',
    'administrator': 'administrator',
    'admin': 'administrator'
}

class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    officer_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    rank = serializers.CharField(max_length=100, required=False, default='Police Officer')
    police_station = serializers.CharField(max_length=150, required=False, default='Siliguri Police Station')
    role = serializers.CharField(max_length=50, required=False, default='police_officer')
    avatar = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        norm_email = value.lower().strip()
        if User.objects.filter(email=norm_email).exists():
            raise serializers.ValidationError("An officer account with this email already exists.")
        return norm_email

    def validate_officer_id(self, value):
        if not value:
            return value
        norm_id = value.strip().upper()
        if User.objects.filter(officer_id__iexact=norm_id).exists():
            raise serializers.ValidationError("An officer account with this Officer ID / Badge ID already exists.")
        return norm_id

    def validate(self, data):
        if data.get('password') != data.get('confirm_password'):
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        raw_role = (data.get('role') or 'police_officer').strip().lower()
        role_key = ROLE_CATEGORY_ALIAS.get(raw_role, raw_role)
        rank = (data.get('rank') or '').strip()

        if role_key not in VALID_ROLE_RANKS:
            raise serializers.ValidationError({"role": f"Invalid category '{data.get('role')}'. Must be Officer, Senior Officer, Legal Officer, or Administrator."})

        allowed_ranks = VALID_ROLE_RANKS[role_key]
        if rank and rank not in allowed_ranks:
            role_display = role_key.replace('_', ' ').title()
            raise serializers.ValidationError({
                "rank": f"Invalid Rank/Designation '{rank}' for Category '{role_display}'."
            })

        data['role'] = role_key
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')
        email = validated_data.get('email')
        
        username = email.split('@')[0]
        count = 1
        base_username = username
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{count}"
            count += 1

        officer_id = validated_data.get('officer_id') or f"POL-{User.objects.count() + 8840}"

        user = User.objects.create(
            username=username,
            email=email,
            name=validated_data.get('name'),
            officer_id=officer_id,
            rank=validated_data.get('rank', 'Police Officer'),
            police_station=validated_data.get('police_station', 'Siliguri Police Station'),
            role=validated_data.get('role', 'police_officer'),
            role_label=validated_data.get('role', 'police_officer').replace('_', ' ').title(),
            avatar=validated_data.get('avatar') or '👮'
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        credential = data.get('email', '').strip()
        password = data.get('password', '')

        if not credential:
            raise serializers.ValidationError("Email or Officer ID is required.")

        norm_cred = credential.lower()
        user = User.objects.filter(
            models.Q(email__iexact=norm_cred) |
            models.Q(officer_id__iexact=credential) |
            models.Q(username__iexact=norm_cred)
        ).first()

        if not user:
            raise serializers.ValidationError("Invalid credentials. Officer account not found.")

        if not user.check_password(password):
            raise serializers.ValidationError("Invalid credentials. Incorrect password.")

        if user.status == 'Disabled' or not user.is_active:
            raise serializers.ValidationError("This officer account is deactivated. Contact Administrator.")

        data['user'] = user
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)


class ResetPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False)
    otp = serializers.CharField(required=False, min_length=6, max_length=6)
    token = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        pass_val = data.get('password') or data.get('new_password')
        confirm_val = data.get('confirm_password')

        if not pass_val:
            raise serializers.ValidationError({"password": "Password field is required."})

        if pass_val != confirm_val:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        if len(pass_val) < 8:
            raise serializers.ValidationError({"password": "Password must be at least 8 characters long."})

        data['clean_password'] = pass_val
        return data
