"""
Unit tests for api/index.py
Tests Flask API endpoints for Vercel deployment
"""
import pytest
import json
import sys
import os
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Set environment before importing
os.environ['APP_PASSWORD'] = 'test_password'

# Add api directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'api'))

# Mock firebase before importing
sys.modules['firebase_admin'] = MagicMock()
sys.modules['firebase_admin.credentials'] = MagicMock()
sys.modules['firebase_admin.storage'] = MagicMock()

from index import app


@pytest.fixture
def client():
    """Create test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


TEST_PASSWORD = 'test_password'


class TestFlaskAPI:
    """Test Flask API endpoints"""
    
    def test_login_success(self, client):
        """Test successful login"""
        response = client.post('/api/login', 
            json={'password': TEST_PASSWORD},
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'token' in data
        assert data['token'] == TEST_PASSWORD
    
    def test_login_failure(self, client):
        """Test login with wrong password"""
        response = client.post('/api/login',
            json={'password': 'wrong_password'},
            content_type='application/json'
        )
        assert response.status_code == 401
        data = json.loads(response.data)
        assert 'error' in data
    
    def test_list_files_unauthorized(self, client):
        """Test listing files without authentication"""
        response = client.get('/api/files')
        assert response.status_code == 401
    
    def test_list_files_wrong_token(self, client):
        """Test listing files with wrong token"""
        response = client.get('/api/files',
            headers={'Authorization': 'Bearer wrong_token'}
        )
        assert response.status_code == 401
    
    @patch('index.storage')
    def test_list_files_success(self, mock_storage, client):
        """Test successful file listing"""
        # Mock storage bucket and blobs
        mock_blob1 = Mock()
        mock_blob1.name = 'document1.md'
        mock_blob2 = Mock()
        mock_blob2.name = 'document2.md'
        mock_blob3 = Mock()
        mock_blob3.name = 'image.png'  # Should not be included
        
        mock_bucket = Mock()
        mock_bucket.list_blobs.return_value = [mock_blob1, mock_blob2, mock_blob3]
        mock_storage.bucket.return_value = mock_bucket
        
        response = client.get('/api/files',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, list)
        assert 'document1.md' in data
        assert 'document2.md' in data
        assert 'image.png' not in data
    
    def test_get_file_unauthorized(self, client):
        """Test getting file without authentication"""
        response = client.get('/api/file?path=test.md')
        assert response.status_code == 401
    
    def test_get_file_missing_path(self, client):
        """Test getting file without path parameter"""
        response = client.get('/api/file',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 400
    
    @patch('index.storage')
    def test_get_file_not_found(self, mock_storage, client):
        """Test getting non-existent file"""
        mock_blob = Mock()
        mock_blob.exists.return_value = False
        
        mock_bucket = Mock()
        mock_bucket.blob.return_value = mock_blob
        mock_storage.bucket.return_value = mock_bucket
        
        response = client.get('/api/file?path=nonexistent.md',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 404
    
    @patch('index.storage')
    def test_get_file_success(self, mock_storage, client):
        """Test successful file retrieval"""
        mock_blob = Mock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_text.return_value = "# Test Content"
        
        mock_bucket = Mock()
        mock_bucket.blob.return_value = mock_blob
        mock_storage.bucket.return_value = mock_bucket
        
        response = client.get('/api/file?path=test.md',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'content' in data
        assert data['content'] == "# Test Content"
    
    def test_save_file_unauthorized(self, client):
        """Test saving file without authentication"""
        response = client.post('/api/save',
            json={'path': 'test.md', 'content': 'test'},
            content_type='application/json'
        )
        assert response.status_code == 401
    
    def test_save_file_missing_data(self, client):
        """Test saving file with incomplete data"""
        response = client.post('/api/save',
            json={'path': 'test.md'},  # Missing content
            content_type='application/json',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 400
    
    @patch('index.storage')
    def test_save_file_success(self, mock_storage, client):
        """Test successful file save"""
        mock_blob = Mock()
        mock_bucket = Mock()
        mock_bucket.blob.return_value = mock_blob
        mock_storage.bucket.return_value = mock_bucket
        
        response = client.post('/api/save',
            json={'path': 'test.md', 'content': '# New Content'},
            content_type='application/json',
            headers={'Authorization': f'Bearer {TEST_PASSWORD}'}
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data['success'] is True
        mock_blob.upload_from_string.assert_called_once_with('# New Content')
