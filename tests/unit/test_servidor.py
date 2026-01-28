"""
Unit tests for servidor.py
Tests authentication, session management, and helper functions
"""
import pytest
import json
import secrets
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop

# Import the server module
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from servidor import (
    sanitize_workspace,
    create_session,
    fetch_session,
    fetch_invite,
    store_invite,
    create_app,
    MEM_SESSIONS,
    MEM_INVITES
)


class TestHelperFunctions:
    """Test helper functions"""
    
    def test_sanitize_workspace(self):
        """Test workspace name sanitization"""
        assert sanitize_workspace("user@example.com") == "user"
        assert sanitize_workspace("test.user@domain.com") == "test-user"
        assert sanitize_workspace("user123@test.com") == "user123"
        assert sanitize_workspace("@invalid.com") == "workspace"  # fallback
    
    def test_create_and_fetch_session_memory(self):
        """Test session creation and retrieval with in-memory storage"""
        MEM_SESSIONS.clear()
        
        # Create a session
        email = "test@example.com"
        workspace = "test-workspace"
        token = create_session(email, workspace)
        
        assert token is not None
        assert len(token) > 0
        
        # Fetch the session
        session = fetch_session(token)
        assert session is not None
        assert session['email'] == email
        assert session['workspace'] == workspace
    
    def test_fetch_session_invalid_token(self):
        """Test fetching session with invalid token"""
        MEM_SESSIONS.clear()
        session = fetch_session("invalid-token")
        assert session is None
    
    def test_store_and_fetch_invite(self):
        """Test invite storage and retrieval"""
        MEM_INVITES.clear()
        
        code = "TEST123"
        data = {
            'workspace': 'test-workspace',
            'createdBy': 'admin@test.com',
            'target': 'user@test.com'
        }
        
        store_invite(code, data)
        retrieved = fetch_invite(code)
        
        assert retrieved is not None
        assert retrieved['workspace'] == data['workspace']
        assert retrieved['createdBy'] == data['createdBy']
        assert retrieved['target'] == data['target']
    
    def test_fetch_invite_invalid_code(self):
        """Test fetching invite with invalid code"""
        MEM_INVITES.clear()
        invite = fetch_invite("INVALID")
        assert invite is None


class TestServerEndpoints(AioHTTPTestCase):
    """Test server HTTP endpoints"""
    
    async def get_application(self):
        """Create test application"""
        return create_app()
    
    @unittest_run_loop
    async def test_index_endpoint(self):
        """Test that index.html is served"""
        resp = await self.client.request("GET", "/")
        assert resp.status == 200
        text = await resp.text()
        assert "html" in text.lower()
    
    @unittest_run_loop
    async def test_login_success(self):
        """Test successful login"""
        resp = await self.client.request(
            "POST",
            "/api/login",
            json={
                "email": "test@example.com",
                "password": "admin"  # Default password
            }
        )
        assert resp.status == 200
        data = await resp.json()
        assert data['success'] is True
        assert 'token' in data
        assert 'workspace' in data
    
    @unittest_run_loop
    async def test_login_missing_email(self):
        """Test login without email"""
        resp = await self.client.request(
            "POST",
            "/api/login",
            json={
                "password": "admin"
            }
        )
        assert resp.status == 400
        data = await resp.json()
        assert 'error' in data
    
    @unittest_run_loop
    async def test_login_wrong_password(self):
        """Test login with wrong password"""
        resp = await self.client.request(
            "POST",
            "/api/login",
            json={
                "email": "test@example.com",
                "password": "wrongpassword"
            }
        )
        assert resp.status == 401
        data = await resp.json()
        assert data['success'] is False
    
    @unittest_run_loop
    async def test_files_endpoint_unauthorized(self):
        """Test files endpoint without authentication"""
        resp = await self.client.request("GET", "/api/files")
        assert resp.status == 401
    
    @unittest_run_loop
    async def test_files_endpoint_authorized(self):
        """Test files endpoint with authentication"""
        # First login to get token
        login_resp = await self.client.request(
            "POST",
            "/api/login",
            json={"email": "test@example.com", "password": "admin"}
        )
        login_data = await login_resp.json()
        token = login_data['token']
        
        # Now request files
        resp = await self.client.request(
            "GET",
            "/api/files",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status == 200
        data = await resp.json()
        assert isinstance(data, list)
    
    @unittest_run_loop
    async def test_save_endpoint_unauthorized(self):
        """Test save endpoint without authentication"""
        resp = await self.client.request(
            "POST",
            "/api/save",
            json={"path": "test.md", "content": "test"}
        )
        assert resp.status == 401
    
    @unittest_run_loop
    async def test_invite_creation(self):
        """Test creating an invite"""
        # Login first
        login_resp = await self.client.request(
            "POST",
            "/api/login",
            json={"email": "admin@example.com", "password": "admin"}
        )
        login_data = await login_resp.json()
        token = login_data['token']
        
        # Create invite
        resp = await self.client.request(
            "POST",
            "/api/invitations",
            headers={"Authorization": f"Bearer {token}"},
            json={"email": "guest@example.com"}
        )
        assert resp.status == 200
        data = await resp.json()
        assert 'code' in data
        assert 'link' in data
