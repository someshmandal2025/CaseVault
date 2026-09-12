import re
from rest_framework import serializers
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    officerId = serializers.CharField(source='officer_id', read_only=True)
    badgeNumber = serializers.CharField(source='officer_id', read_only=True)
    badge_number = serializers.CharField(source='officer_id', read_only=True)
    full_name = serializers.CharField(source='name', read_only=True)
    policeStation = serializers.CharField(source='police_station', read_only=True)
    police_station = serializers.CharField(read_only=True)
    category = serializers.CharField(source='role', read_only=True)
    roleLabel = serializers.CharField(source='role_label', read_only=True)
    role_label = serializers.CharField(read_only=True)
    phone_number = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)
    updated_at = serializers.DateTimeField(source='date_joined', read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'officer_id',
            'officerId',
            'badge_number',
            'badgeNumber',
            'name',
            'full_name',
            'email',
            'phone_number',
            'rank',
            'police_station',
            'policeStation',
            'district',
            'category',
            'role',
            'role_label',
            'roleLabel',
            'status',
            'avatar',
            'created_at',
            'updated_at'
        ]

    def get_phone_number(self, obj):
        return getattr(obj, 'phone', '') or ''


VALID_ROLE_RANKS = {
    'police_officer': {'Constable', 'Head Constable', 'ASI', 'SI'},
    'senior_officer': {'Inspector', 'ACP / DSP', 'Addl. SP', 'SP / SSP', 'DIG', 'IG', 'ADGP', 'DGP'},
    'legal_officer': {'Legal Officer', 'Public Prosecutor', 'Legal Advisor', 'Law Officer'},
    'administrator': {'System Administrator', 'Administrative Officer', 'Department Administrator', 'IT / System Manager'}
}

RANK_NORMALIZATION = {
    'sub-inspector': 'SI',
    'sub inspector': 'SI',
    'assistant sub-inspector': 'ASI',
    'assistant sub inspector': 'ASI',
    'head constable': 'Head Constable',
    'acp': 'ACP / DSP',
    'dsp': 'ACP / DSP',
    'additional sp': 'Addl. SP',
    'addl sp': 'Addl. SP',
    'sp': 'SP / SSP',
    'ssp': 'SP / SSP',
    'superintendent of police': 'SP / SSP',
    'app': 'Public Prosecutor',
    'assistant public prosecutor': 'Public Prosecutor',
    'asst. public prosecutor': 'Public Prosecutor',
    'it manager': 'IT / System Manager',
    'system manager': 'IT / System Manager',
    'inspector': 'Inspector',
    'constable': 'Constable',
    'asi': 'ASI',
    'si': 'SI',
    'dgp': 'DGP',
    'adgp': 'ADGP',
    'ig': 'IG',
    'dig': 'DIG',
    'legal officer': 'Legal Officer',
    'public prosecutor': 'Public Prosecutor',
    'legal advisor': 'Legal Advisor',
    'law officer': 'Law Officer',
    'system administrator': 'System Administrator',
    'administrative officer': 'Administrative Officer',
    'department administrator': 'Department Administrator',
    'it / system manager': 'IT / System Manager'
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
    name = serializers.CharField(max_length=150, required=False)
    full_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, required=False)
    officer_id = serializers.CharField(max_length=50, required=False, allow_blank=True)
    badge_number = serializers.CharField(max_length=50, required=False, allow_blank=True)
    rank = serializers.CharField(max_length=100, required=False, default='Constable')
    police_station = serializers.CharField(max_length=150, required=False, default='Siliguri Police Station')
    role = serializers.CharField(max_length=50, required=False)
    category = serializers.CharField(max_length=50, required=False)
    phone_number = serializers.CharField(max_length=30, required=False, allow_blank=True)
    avatar = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        norm_email = value.lower().strip()
        if User.objects.filter(email=norm_email).exists():
            raise serializers.ValidationError({
                "code": "DUPLICATE_EMAIL",
                "message": "An account with this email already exists."
            })
        return norm_email

    def validate_officer_id(self, value):
        if not value:
            return value
        norm_id = value.strip().upper()
        if User.objects.filter(officer_id__iexact=norm_id).exists():
            raise serializers.ValidationError({
                "code": "DUPLICATE_OFFICER_ID",
                "message": "An officer with this Officer ID already exists."
            })
        return norm_id

    def validate(self, data):
        officer_name = data.get('full_name') or data.get('name')
        if not officer_name:
            raise serializers.ValidationError({"name": "Full name is required."})
        data['name'] = officer_name

        confirm_pass = data.get('confirm_password')
        if confirm_pass and data.get('password') != confirm_pass:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        raw_role = (data.get('category') or data.get('role') or 'police_officer').strip().lower()
        role_key = ROLE_CATEGORY_ALIAS.get(raw_role, raw_role)
        raw_rank = (data.get('rank') or 'Constable').strip()
        norm_rank = RANK_NORMALIZATION.get(raw_rank.lower(), raw_rank)

        if role_key not in VALID_ROLE_RANKS:
            raise serializers.ValidationError({
                "code": "INVALID_ROLE_RANK",
                "message": f"Invalid Category '{raw_role}'."
            })

        allowed_ranks = VALID_ROLE_RANKS[role_key]
        if norm_rank and norm_rank not in allowed_ranks:
            raise serializers.ValidationError({
                "code": "INVALID_ROLE_RANK",
                "message": "Invalid Category and Rank combination."
            })

        data['role'] = role_key
        data['rank'] = norm_rank
        data['officer_id'] = data.get('officer_id') or data.get('badge_number') or ''
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)
        validated_data.pop('full_name', None)
        validated_data.pop('category', None)
        validated_data.pop('badge_number', None)
        validated_data.pop('phone_number', None)

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
            rank=validated_data.get('rank', 'Constable'),
            police_station=validated_data.get('police_station', 'Siliguri Police Station'),
            role=validated_data.get('role', 'police_officer'),
            role_label=validated_data.get('role', 'police_officer').replace('_', ' ').title(),
            avatar=validated_data.get('avatar') or '👮'
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        credential = (data.get('identifier') or data.get('email') or '').strip()
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
            raise serializers.ValidationError({
                "code": "INVALID_CREDENTIALS",
                "message": "Invalid credentials."
            })

        if not user.check_password(password):
            raise serializers.ValidationError({
                "code": "INVALID_CREDENTIALS",
                "message": "Invalid credentials."
            })

        if user.status == 'Disabled' or not user.is_active:
            raise serializers.ValidationError({
                "code": "ACCOUNT_DISABLED",
                "message": "Account is disabled."
            })

        data['user'] = user
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        val = (data.get('identifier') or data.get('email') or '').strip()
        if not val:
            raise serializers.ValidationError("Email or Officer ID is required.")
        data['clean_identifier'] = val
        return data


class VerifyOTPSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate(self, data):
        val = (data.get('identifier') or data.get('email') or '').strip()
        if not val:
            raise serializers.ValidationError("Email or Officer ID is required.")
        data['clean_identifier'] = val
        return data


class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    otp = serializers.CharField(required=False, min_length=6, max_length=6)
    token = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True, required=False)

    def validate(self, data):
        pass_val = data.get('new_password') or data.get('password')
        if not pass_val:
            raise serializers.ValidationError({"password": "New password field is required."})

        if len(pass_val) < 8:
            raise serializers.ValidationError({"password": "Password must be at least 8 characters long."})

        data['clean_password'] = pass_val
        data['clean_identifier'] = (data.get('identifier') or data.get('email') or '').strip()
        return data

