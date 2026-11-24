import time
from sqlalchemy import Boolean, Column, Float, Integer, JSON, String, Text
from db.session import Base


class UserWorkspaceModel(Base):
    __tablename__ = "user_workspaces"

    user_id = Column(String, primary_key=True, index=True)
    favourites_json = Column(JSON, nullable=False, default=list)
    compare_json = Column(JSON, nullable=False, default=list)
    hidden_ids_json = Column(JSON, nullable=False, default=list)
    preferences = Column(Text, nullable=False, default="")
    updated_at = Column(Float, nullable=False, default=time.time)


class InspectionModel(Base):
    __tablename__ = "inspections"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    property_id = Column(String, nullable=False, default="", index=True)
    property_address = Column(Text, nullable=False, default="")
    normalized_address = Column(Text, nullable=False, default="", index=True)
    suburb = Column(String, nullable=False, default="", index=True)
    lat = Column(Float, nullable=False, default=0.0)
    lng = Column(Float, nullable=False, default=0.0)
    is_public_snags = Column(Boolean, nullable=False, default=False, index=True)
    landlord_or_agent = Column(Text, nullable=False, default="")
    lease_start_date = Column(String, nullable=False, default="")
    water_meter = Column(String, nullable=False, default="")
    electricity_meter = Column(String, nullable=False, default="")
    keys_notes = Column(Text, nullable=False, default="")
    items_json = Column(JSON, nullable=False, default=list)
    updated_at = Column(Float, nullable=False, default=time.time)


class AiAnalysisModel(Base):
    __tablename__ = "ai_analyses"

    listing_id = Column(String, primary_key=True, index=True)
    fit_score = Column(Integer, nullable=True)
    forensic_json = Column(JSON, nullable=False, default=dict)
    updated_at = Column(Float, nullable=False, default=time.time)


class UserProfileModel(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String, primary_key=True, index=True)
    email = Column(String, nullable=False, default="")
    name = Column(String, nullable=False, default="")
    photo = Column(Text, nullable=False, default="")
    tier = Column(String, nullable=False, default="free", index=True)
    ai_credits = Column(Integer, nullable=False, default=0)
    auth_provider = Column(String, nullable=False, default="google")
    profile_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(Float, nullable=False, default=time.time)
    last_active = Column(Float, nullable=False, default=time.time)


class UserAlertModel(Base):
    __tablename__ = "user_alerts"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    search_query = Column(Text, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    alert_json = Column(JSON, nullable=False, default=dict)
    updated_at = Column(Float, nullable=False, default=time.time)


class TaskModel(Base):
    __tablename__ = "scan_tasks"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    query = Column(Text, nullable=False, default="")
    status = Column(String, nullable=False, default="Initializing")
    progress = Column(Integer, nullable=False, default=0)
    completed = Column(Boolean, nullable=False, default=False)
    logs_json = Column(JSON, nullable=False, default=list)
    created_at = Column(Float, nullable=False, default=time.time)
    updated_at = Column(Float, nullable=False, default=time.time)


class FingerprintModel(Base):
    __tablename__ = "fingerprints"

    hash_key = Column(String, primary_key=True, index=True)
    metadata_json = Column(JSON, nullable=False, default=dict)
    scanned_at = Column(Float, nullable=False, default=time.time)


class AppSettingModel(Base):
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True, index=True)
    value_json = Column(JSON, nullable=False, default=dict)
    updated_at = Column(Float, nullable=False, default=time.time)


class SentAlertListingModel(Base):
    __tablename__ = "sent_alert_listings"

    id = Column(String, primary_key=True, index=True)
    alert_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    listing_id = Column(String, nullable=False, index=True)
    fit_score = Column(Integer, nullable=False, default=0)
    sent_at = Column(Float, nullable=False, default=time.time)


class AlertReportModel(Base):
    __tablename__ = "alert_reports"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    alert_id = Column(String, nullable=False, index=True)
    report_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(Float, nullable=False, default=time.time)


class CreditTransactionModel(Base):
    __tablename__ = "credit_transactions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False, index=True)
    credits_delta = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(Float, nullable=False, default=time.time)
