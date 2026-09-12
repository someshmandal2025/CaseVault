"""
CASEVAULT - MongoDB Secondary Database Connection Utility
Provides a thread-safe, reusable PyMongo client for secondary document storage
(case document metadata, evidence logs, SHA-256 hash chains, and audit records).
"""

import logging
from django.conf import settings
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

logger = logging.getLogger(__name__)

_client_instance = None


def get_mongo_client():
    """
    Returns a singleton MongoClient instance configured with sensible defaults.
    Avoids instantiating a new MongoClient on every request.
    """
    global _client_instance
    if _client_instance is None:
        import sys
        mongo_uri = getattr(settings, 'MONGO_URI', 'mongodb://localhost:27017/')
        timeout_ms = 300 if 'test' in sys.argv else 3000
        _client_instance = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=timeout_ms,
            connectTimeoutMS=timeout_ms
        )
    return _client_instance


def get_mongo_db():
    """
    Returns the target PyMongo Database instance for CaseVault.
    """
    client = get_mongo_client()
    db_name = getattr(settings, 'MONGO_DB_NAME', 'casevault')
    return client[db_name]


def ping_mongo():
    """
    Safely tests the connection to the MongoDB instance using the admin ping command.
    Returns: (success: bool, status_message: str, details: dict)
    Note: Never exposes URI or credentials in the output.
    """
    try:
        client = get_mongo_client()
        # Execute admin command 'ping'
        client.admin.command('ping')
        return True, "MongoDB connected successfully", {
            "status": "connected",
            "database_name": getattr(settings, 'MONGO_DB_NAME', 'casevault')
        }
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.warning(f"MongoDB connection ping failed: {str(e)}")
        return False, "MongoDB connection ping failed or service unavailable.", {
            "status": "disconnected",
            "error": "ServerSelectionTimeoutError / Service Unreachable"
        }
    except Exception as e:
        logger.error(f"Unexpected MongoDB error during ping: {str(e)}")
        return False, "MongoDB connection error occurred.", {
            "status": "error",
            "error": "Unexpected database error"
        }


def setup_mongo_indexes():
    """
    Idempotent initialization of MongoDB collection indexes for CaseVault secondary document store.
    Creates unique indexes for case_id, document_id, evidence_id, event_id.
    Note: NO sample or demo records are inserted.
    """
    try:
        db = get_mongo_db()

        # 1. Cases Indexes
        db.cases.create_index("case_id", unique=True)
        db.cases.create_index("created_by")
        db.cases.create_index("created_by_officer_id")
        db.cases.create_index("investigating_officer_id")
        db.cases.create_index("status")
        db.cases.create_index("police_station")
        db.cases.create_index("created_at")

        # 2. Case Documents Indexes
        db.case_documents.create_index("document_id", unique=True)
        db.case_documents.create_index("case_id")
        db.case_documents.create_index("sha256")
        db.case_documents.create_index("sha256_hash")
        db.case_documents.create_index("uploaded_by_officer_id")
        db.case_documents.create_index("uploaded_by")
        db.case_documents.create_index("created_at")
        db.case_documents.create_index("uploaded_at")

        # 3. Evidence Indexes
        db.evidence.create_index("evidence_id", unique=True)
        db.evidence.create_index("case_id")
        db.evidence.create_index("document_id")
        db.evidence.create_index("sha256")
        db.evidence.create_index("sha256_hash")
        db.evidence.create_index("created_by_officer_id")
        db.evidence.create_index("recorded_by_officer_id")
        db.evidence.create_index("created_at")
        db.evidence.create_index("recorded_at")

        # 4. Chain of Custody Indexes
        db.chain_of_custody.create_index("evidence_id")
        db.chain_of_custody.create_index("document_id")
        db.chain_of_custody.create_index("case_id")
        db.chain_of_custody.create_index("timestamp")
        db.chain_of_custody.create_index("performed_at")
        db.chain_of_custody.create_index("actor_officer_id")

        # 5. Audit Logs Indexes
        db.audit_logs.create_index("audit_id", unique=True)
        db.audit_logs.create_index("timestamp")
        db.audit_logs.create_index("event_type")
        db.audit_logs.create_index("actor_officer_id")
        db.audit_logs.create_index("case_id")
        db.audit_logs.create_index("document_id")
        db.audit_logs.create_index("evidence_id")
        db.audit_logs.create_index("record_hash")
        db.audit_logs.create_index([("timestamp", -1), ("event_type", 1)])

        return True, "MongoDB indexes initialized successfully", {
            "collections_indexed": ["cases", "case_documents", "evidence", "chain_of_custody", "audit_logs"]
        }
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        logger.warning(f"MongoDB index setup deferred: server offline ({str(e)})")
        return False, "MongoDB server offline; index setup deferred.", {
            "status": "deferred",
            "reason": "ServerSelectionTimeoutError"
        }
    except Exception as e:
        logger.error(f"Error during MongoDB index setup: {str(e)}")
        return False, f"Error setting up MongoDB indexes: {str(e)}", {
            "status": "error"
        }

